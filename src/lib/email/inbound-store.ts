import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { InboundEmailEvent } from "./inbound-verify";
import {
  defaultMailbox,
  extractEmailAddress,
  resolveMailbox,
  type CompanyMailbox,
} from "./mailboxes";
import {
  fetchReceivingEmail,
  threadingFromHeaders,
  type ReceivingAttachmentMeta,
  type ReceivingEmailContent,
} from "./receiving-fetch";
import { prepareStoredEmailBodies } from "./sanitize-email-html";

/**
 * Persiste un email inbound verificado en Supabase (email_threads + email_messages).
 *
 * Idempotente por resend_email_id: un duplicado no inserta y devuelve
 * { stored: false, reason: "duplicate" }.
 *
 * Escribe con el cliente service_role (bypass RLS). Las lecturas pasan por
 * sesión y RLS (solo Admin).
 *
 * Tras guardar metadatos, intenta cargar el cuerpo completo del mensaje
 * vía la Receiving API de Resend (una sola llamada; error del SDK se registra).
 */

export type StoreResult =
  | { stored: true; threadId: string; messageId: string }
  | { stored: false; reason: "duplicate" | "db-error"; detail?: string };

export async function storeInboundEmail(
  admin: SupabaseClient,
  event: InboundEmailEvent,
): Promise<StoreResult> {
  const { data } = event;

  const existingMsg = await admin
    .from("email_messages")
    .select("id")
    .eq("resend_email_id", data.email_id)
    .maybeSingle();

  if (existingMsg.data) {
    return { stored: false, reason: "duplicate" };
  }

  const fromAddress = extractEmailAddress(data.from);
  const fromName = extractName(data.from);
  const mailboxAddress =
    resolveMailbox(data.to ?? [], data.cc ?? [], data.bcc ?? []) ??
    defaultMailbox();

  // Una sola llamada a Receiving API: cuerpo + cabeceras de hilo + adjuntos.
  const receiving = await fetchReceivingEmail(data.email_id);
  const full: ReceivingEmailContent | null = receiving.ok ? receiving.data : null;
  const { inReplyTo, references } = threadingFromHeaders(full?.headers);

  const threadId = await findOrCreateThread(admin, {
    messageId: data.message_id,
    inReplyTo,
    references,
    subject: data.subject ?? "(sin asunto)",
    fromAddress,
    fromName,
    mailboxAddress,
  });

  if (!threadId) {
    return { stored: false, reason: "db-error", detail: "thread creation failed" };
  }

  let bodyHtml: string | null = full?.html ?? null;
  let bodyText: string | null = full?.text ?? null;

  const prepared = prepareStoredEmailBodies(bodyHtml, bodyText);
  bodyHtml = prepared.html;
  bodyText = prepared.text;

  const { data: msg, error: msgErr } = await admin
    .from("email_messages")
    .insert({
      thread_id: threadId,
      resend_email_id: data.email_id,
      message_id: data.message_id ?? null,
      in_reply_to: inReplyTo,
      references,
      direction: "inbound",
      from_address: fromAddress,
      from_name: fromName,
      to_addresses: (data.to ?? []).map(extractEmailAddress),
      cc_addresses: (data.cc ?? []).map(extractEmailAddress),
      bcc_addresses: (data.bcc ?? []).map(extractEmailAddress),
      subject: data.subject ?? null,
      body_html: bodyHtml,
      body_text: bodyText,
      received_at: data.created_at ?? new Date().toISOString(),
    })
    .select("id")
    .single();

  if (msgErr || !msg) {
    if (msgErr?.code === "23505") {
      return { stored: false, reason: "duplicate" };
    }
    return { stored: false, reason: "db-error", detail: msgErr?.message };
  }

  if (data.attachments?.length) {
    const sizeByResendId = sizeMapFromReceiving(full?.attachments);
    const attachmentRows = data.attachments
      .filter((a) => a.id && a.filename)
      .map((a) => ({
        message_id: msg.id,
        resend_attachment_id: a.id,
        filename: a.filename,
        content_type: a.content_type || "application/octet-stream",
        size_bytes: sizeByResendId.get(a.id) ?? null,
      }));

    if (attachmentRows.length > 0) {
      const { error: attErr } = await admin
        .from("email_attachments")
        .insert(attachmentRows);
      if (attErr) {
        console.warn("[inbound-store] Failed to insert attachments", attErr.message);
      }
    }
  }

  await admin
    .from("email_threads")
    .update({
      last_message_at: data.created_at ?? new Date().toISOString(),
      message_count: await countMessages(admin, threadId),
      is_read: false,
    })
    .eq("id", threadId);

  return { stored: true, threadId, messageId: msg.id };
}

async function findOrCreateThread(
  admin: SupabaseClient,
  opts: {
    messageId?: string;
    inReplyTo: string | null;
    references: string | null;
    subject: string;
    fromAddress: string;
    fromName?: string | null;
    mailboxAddress: CompanyMailbox;
  },
): Promise<string | null> {
  const searchIds: string[] = [];
  if (opts.inReplyTo) searchIds.push(opts.inReplyTo);
  if (opts.references) {
    for (const ref of opts.references.split(/\s+/)) {
      if (ref && !searchIds.includes(ref)) searchIds.push(ref);
    }
  }
  if (opts.messageId && !searchIds.includes(opts.messageId)) {
    searchIds.push(opts.messageId);
  }

  for (const searchId of searchIds) {
    const { data: existingByRef } = await admin
      .from("email_messages")
      .select("thread_id")
      .eq("message_id", searchId)
      .limit(1)
      .maybeSingle();

    if (existingByRef?.thread_id) {
      return existingByRef.thread_id;
    }
  }

  const { data: thread, error } = await admin
    .from("email_threads")
    .insert({
      subject: opts.subject,
      from_address: opts.fromAddress,
      from_name: opts.fromName ?? null,
      mailbox_address: opts.mailboxAddress,
    })
    .select("id")
    .single();

  if (error || !thread) {
    console.error("[inbound-store] Failed to create thread", error?.message);
    return null;
  }

  return thread.id;
}

function sizeMapFromReceiving(
  attachments: ReceivingAttachmentMeta[] | undefined,
): Map<string, number> {
  const map = new Map<string, number>();
  if (!attachments) return map;
  for (const a of attachments) {
    if (a.id && typeof a.size === "number" && Number.isFinite(a.size)) {
      map.set(a.id, a.size);
    }
  }
  return map;
}

async function countMessages(
  admin: SupabaseClient,
  threadId: string,
): Promise<number> {
  const { count } = await admin
    .from("email_messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", threadId);
  return count ?? 1;
}

function extractName(address: string): string | null {
  const match = /^"?([^"<]+)"?\s*</.exec(address);
  return match?.[1]?.trim() ?? null;
}
