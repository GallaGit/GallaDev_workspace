import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resend } from "resend";
import { resolveAttachmentDownload } from "./attachment-download";
import { MAX_EMAIL_BODY_CHARS } from "./limits";
import {
  displayFrom,
  extractEmailAddress,
  isCompanyMailbox,
  isValidExternalEmail,
} from "./mailboxes";
import { createOutboundMessageId } from "./receiving-fetch";
import { getResendClient } from "./resend-client";
import { prepareStoredEmailBodies } from "./sanitize-email-html";
import { fetchSentMessageId } from "./thread-match";
import { forwardSubject } from "./threading";

/**
 * Reenvía el último mensaje de un hilo a otra dirección.
 *
 * - Cuerpo: texto del usuario + cabecera "Mensaje reenviado" + original citado.
 * - Adjuntos: se pasan a Resend como `path` con la URL firmada del adjunto
 *   original (Resend la descarga). Si un adjunto ya no está disponible
 *   (Resend borra a los ~30 días), se añade una nota con su nombre.
 * - El mensaje saliente se guarda en el mismo hilo (como Gmail).
 */

export interface ForwardInput {
  threadId: string;
  to: string;
  bodyText: string;
}

export type ForwardResult =
  | { sent: true; messageId: string; attached: number; missing: string[] }
  | {
      sent: false;
      reason:
        | "no-client"
        | "no-thread"
        | "no-message"
        | "invalid-mailbox"
        | "invalid-recipient"
        | "invalid-body"
        | "send-failed"
        | "db-error";
      detail?: string;
    };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildForwardBodies(
  userText: string,
  original: {
    from_address: string;
    from_name?: string | null;
    to_addresses?: string[] | null;
    subject?: string | null;
    received_at: string;
    body_text?: string | null;
    body_html?: string | null;
  },
  missing: string[] = [],
): { text: string; html: string } {
  const from = original.from_name
    ? `${original.from_name} <${original.from_address}>`
    : original.from_address;
  const headerLines = [
    "---------- Mensaje reenviado / Forwarded message ----------",
    `De / From: ${from}`,
    `Fecha / Date: ${new Date(original.received_at).toUTCString()}`,
    `Asunto / Subject: ${original.subject ?? ""}`,
    `Para / To: ${(original.to_addresses ?? []).join(", ")}`,
  ];
  const note =
    missing.length > 0
      ? `\n\n[Adjuntos no disponibles / Attachments unavailable: ${missing.join(", ")}]`
      : "";
  const originalText = original.body_text ?? "";
  const text = `${userText}\n\n${headerLines.join("\n")}\n\n${originalText}${note}`.trim();

  const userHtml = escapeHtml(userText).replace(/\n/g, "<br>");
  const headerHtml = headerLines.map(escapeHtml).join("<br>");
  const originalHtml =
    original.body_html ?? escapeHtml(originalText).replace(/\n/g, "<br>");
  const noteHtml = note ? `<p>${escapeHtml(note.trim())}</p>` : "";
  const html = `<div>${userHtml}</div><br><div>${headerHtml}</div><br><blockquote style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex">${originalHtml}</blockquote>${noteHtml}`;
  return { text, html };
}

export async function sendForward(
  admin: SupabaseClient,
  input: ForwardInput,
  clientOverride?: Resend | null,
): Promise<ForwardResult> {
  const userText = input.bodyText.trim();
  if (userText.length > MAX_EMAIL_BODY_CHARS) {
    return { sent: false, reason: "invalid-body" };
  }
  if (!isValidExternalEmail(input.to)) {
    return { sent: false, reason: "invalid-recipient" };
  }
  const to = extractEmailAddress(input.to);
  if (isCompanyMailbox(to)) {
    return { sent: false, reason: "invalid-recipient" };
  }

  const client = clientOverride === undefined ? getResendClient() : clientOverride;
  if (!client) return { sent: false, reason: "no-client" };

  const { data: thread } = await admin
    .from("email_threads")
    .select("id, subject, mailbox_address")
    .eq("id", input.threadId)
    .single();
  if (!thread) return { sent: false, reason: "no-thread" };

  const rawMailbox = String(thread.mailbox_address ?? "");
  if (!isCompanyMailbox(rawMailbox)) return { sent: false, reason: "invalid-mailbox" };
  const fromMeta = displayFrom(rawMailbox);

  const { data: msgs } = await admin
    .from("email_messages")
    .select("id, from_address, from_name, to_addresses, subject, received_at, body_text, body_html")
    .eq("thread_id", input.threadId)
    .order("received_at", { ascending: false })
    .limit(1);
  const original = msgs?.[0];
  if (!original) return { sent: false, reason: "no-message" };

  const { data: atts } = await admin
    .from("email_attachments")
    .select("id, filename")
    .eq("message_id", original.id);

  const attachments: { path: string; filename: string }[] = [];
  const missing: string[] = [];
  for (const att of atts ?? []) {
    const resolved = await resolveAttachmentDownload(admin, att.id as string, client);
    if (resolved.ok) {
      attachments.push({ path: resolved.downloadUrl, filename: resolved.filename });
    } else {
      missing.push(String(att.filename ?? "adjunto"));
    }
  }

  const bodies = buildForwardBodies(userText, original, missing);
  const stored = prepareStoredEmailBodies(bodies.html, bodies.text);
  const subject = forwardSubject(thread.subject as string);
  const outboundMessageId = createOutboundMessageId();

  let resendEmailId: string | undefined;
  try {
    const result = await client.emails.send({
      from: fromMeta.from,
      to,
      subject,
      text: stored.text ?? bodies.text,
      ...(stored.html ? { html: stored.html } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
      headers: { "Message-ID": outboundMessageId },
    });
    if (result.error) {
      return { sent: false, reason: "send-failed", detail: result.error.message };
    }
    resendEmailId = result.data?.id;
  } catch (e) {
    return {
      sent: false,
      reason: "send-failed",
      detail: e instanceof Error ? e.message : "Unknown send error",
    };
  }
  if (!resendEmailId) {
    return { sent: false, reason: "send-failed", detail: "No email id returned" };
  }

  const realMessageId =
    (await fetchSentMessageId(client, resendEmailId)) ?? outboundMessageId;
  const now = new Date().toISOString();

  const { data: msg, error: dbErr } = await admin
    .from("email_messages")
    .insert({
      thread_id: input.threadId,
      resend_email_id: resendEmailId,
      message_id: realMessageId,
      in_reply_to: null,
      references: null,
      direction: "outbound",
      from_address: fromMeta.address,
      from_name: fromMeta.name,
      to_addresses: [to],
      cc_addresses: [],
      bcc_addresses: [],
      subject,
      body_html: stored.html,
      body_text: stored.text ?? bodies.text,
      send_status: "delivered",
      received_at: now,
    })
    .select("id")
    .single();
  if (dbErr || !msg) return { sent: false, reason: "db-error", detail: dbErr?.message };

  const { count } = await admin
    .from("email_messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", input.threadId);
  await admin
    .from("email_threads")
    .update({ last_message_at: now, message_count: count ?? 1 })
    .eq("id", input.threadId);

  return { sent: true, messageId: msg.id as string, attached: attachments.length, missing };
}
