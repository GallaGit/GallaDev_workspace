import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  displayFrom,
  extractEmailAddress,
  isCompanyMailbox,
  type CompanyMailbox,
} from "./mailboxes";
import { getResendClient } from "./resend-client";

/**
 * Envía un correo nuevo (compose) desde un buzón de empresa y crea el hilo.
 * Si draftId está presente, borra el borrador solo tras envío OK.
 */

const BASIC_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidExternalEmail(value: string): boolean {
  const email = extractEmailAddress(value);
  return BASIC_EMAIL_RE.test(email) && email.length <= 320;
}

export interface ComposeInput {
  mailbox: CompanyMailbox;
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  draftId?: string;
  leadId?: string | null;
}

export type ComposeResult =
  | { sent: true; threadId: string; messageId: string }
  | {
      sent: false;
      reason:
        | "no-client"
        | "invalid-mailbox"
        | "invalid-to"
        | "empty-subject"
        | "empty-body"
        | "send-failed"
        | "db-error";
      detail?: string;
    };

export async function sendCompose(
  admin: SupabaseClient,
  input: ComposeInput,
): Promise<ComposeResult> {
  if (!isCompanyMailbox(input.mailbox)) {
    return { sent: false, reason: "invalid-mailbox" };
  }

  const to = extractEmailAddress(input.to);
  if (!isValidExternalEmail(to)) {
    return { sent: false, reason: "invalid-to" };
  }

  const subject = input.subject.trim() || "(sin asunto)";
  const bodyText = input.bodyText.trim();
  if (!bodyText) {
    return { sent: false, reason: "empty-body" };
  }

  const client = getResendClient();
  if (!client) {
    return { sent: false, reason: "no-client" };
  }

  const fromMeta = displayFrom(input.mailbox);

  let resendEmailId: string | undefined;
  try {
    const result = await client.emails.send({
      from: fromMeta.from,
      to,
      subject,
      text: bodyText,
      ...(input.bodyHtml ? { html: input.bodyHtml } : {}),
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

  const now = new Date().toISOString();

  const { data: thread, error: threadErr } = await admin
    .from("email_threads")
    .insert({
      subject,
      from_address: to,
      from_name: null,
      mailbox_address: input.mailbox,
      lead_id: input.leadId ?? null,
      last_message_at: now,
      message_count: 1,
      is_read: true,
    })
    .select("id")
    .single();

  if (threadErr || !thread) {
    return { sent: false, reason: "db-error", detail: threadErr?.message };
  }

  const { data: msg, error: msgErr } = await admin
    .from("email_messages")
    .insert({
      thread_id: thread.id,
      resend_email_id: resendEmailId,
      message_id: null,
      in_reply_to: null,
      references: null,
      direction: "outbound",
      from_address: fromMeta.address,
      from_name: fromMeta.name,
      to_addresses: [to],
      cc_addresses: [],
      bcc_addresses: [],
      subject,
      body_html: input.bodyHtml ?? null,
      body_text: bodyText,
      send_status: "delivered",
      received_at: now,
    })
    .select("id")
    .single();

  if (msgErr || !msg) {
    return { sent: false, reason: "db-error", detail: msgErr?.message };
  }

  if (input.draftId) {
    const { error: delErr } = await admin
      .from("email_drafts")
      .delete()
      .eq("id", input.draftId);
    if (delErr) {
      console.warn("[send-compose] draft delete failed", delErr.message);
    }
  }

  return { sent: true, threadId: thread.id, messageId: msg.id };
}
