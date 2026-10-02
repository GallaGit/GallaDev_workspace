import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resend } from "resend";
import type { InboundEmailEvent } from "./inbound-verify";
import {
  defaultMailbox,
  extractEmailAddress,
  resolveMailbox,
  type CompanyMailbox,
} from "./mailboxes";
import { getResendClient } from "./resend-client";
import { prepareStoredEmailBodies } from "./sanitize-email-html";

/** Resend Receiving API shape (not fully typed in the SDK). */
interface ReceivingGetResponse {
  data?: {
    html?: string;
    text?: string;
    in_reply_to?: string;
    references?: string;
  };
}

/** Access the Receiving API on a Resend client. */
function receivingGet(
  client: Resend,
  emailId: string,
): Promise<ReceivingGetResponse> {
  const r = client as unknown as {
    emails: { receiving: { get: (id: string) => Promise<ReceivingGetResponse> } };
  };
  return r.emails.receiving.get(emailId);
}

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
 * vía la Receiving API de Resend.
 */

// 50 MB cap per attachment — enforced when Storage bucket exists.
// const MAX_ATTACHMENT_BYTES = 52_428_800;

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

  const threadId = await findOrCreateThread(admin, {
    emailId: data.email_id,
    messageId: data.message_id,
    subject: data.subject ?? "(sin asunto)",
    fromAddress,
    fromName,
    mailboxAddress,
  });

  if (!threadId) {
    return { stored: false, reason: "db-error", detail: "thread creation failed" };
  }

  let bodyHtml: string | null = null;
  let bodyText: string | null = null;
  let inReplyTo: string | null = null;
  let references: string | null = null;

  try {
    const resend = getResendClient();
    if (resend) {
      const full = await receivingGet(resend, data.email_id);
      if (full?.data) {
        bodyHtml = full.data.html ?? null;
        bodyText = full.data.text ?? null;
        inReplyTo = full.data.in_reply_to ?? null;
        references = full.data.references ?? null;
      }
    }
  } catch (e) {
    console.warn("[inbound-store] Could not fetch full message body", data.email_id, e);
  }

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
    const attachmentRows = data.attachments
      .filter((a) => a.id && a.filename)
      .map((a) => ({
        message_id: msg.id,
        resend_attachment_id: a.id,
        filename: a.filename,
        content_type: a.content_type || "application/octet-stream",
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
    emailId: string;
    messageId?: string;
    subject: string;
    fromAddress: string;
    fromName?: string | null;
    mailboxAddress: CompanyMailbox;
  },
): Promise<string | null> {
  // Try to fetch in_reply_to/references from the full message for threading.
  let inReplyTo: string | null = null;
  let referencesHeader: string | null = null;
  try {
    const resend = getResendClient();
    if (resend) {
      const full = await receivingGet(resend, opts.emailId);
      if (full?.data) {
        inReplyTo = full.data.in_reply_to ?? null;
        referencesHeader = full.data.references ?? null;
      }
    }
  } catch {
    // Non-critical: we'll create a new thread if we can't match.
  }

  // Collect all message_ids to search for an existing thread.
  const searchIds: string[] = [];
  if (inReplyTo) searchIds.push(inReplyTo);
  if (referencesHeader) {
    for (const ref of referencesHeader.split(/\s+/)) {
      if (ref && !searchIds.includes(ref)) searchIds.push(ref);
    }
  }
  if (opts.messageId && !searchIds.includes(opts.messageId)) {
    searchIds.push(opts.messageId);
  }

  // Search for any existing message that has one of these message_ids.
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
