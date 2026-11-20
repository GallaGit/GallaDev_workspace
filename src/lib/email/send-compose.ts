import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  displayFrom,
  extractEmailAddress,
  isCompanyMailbox,
  isValidExternalEmail,
  type CompanyMailbox,
} from "./mailboxes";
import { autoLinkThread } from "./lead-link";
import {
  attachmentsAreValid,
  storeOutboundAttachments,
  toResendAttachments,
  type OutboundAttachment,
} from "./outbound-attachments-store";
import { createOutboundMessageId } from "./receiving-fetch";
import {
  dedupeRecipients,
  exceedsRecipientTotal,
  parseAddressList,
} from "./recipients";
import { fetchSentMessageId } from "./thread-match";
import { getResendClient } from "./resend-client";
import { prepareStoredEmailBodies } from "./sanitize-email-html";

export { isValidExternalEmail };

/**
 * Envía un correo nuevo (compose) desde un buzón de empresa y crea el hilo.
 * Si draftId está presente, borra el borrador solo tras envío OK.
 */

export interface ComposeInput {
  mailbox: CompanyMailbox;
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  draftId?: string;
  leadId?: string | null;
  /** Copia y copia oculta (se validan y se quitan duplicados con «Para»). */
  cc?: string[];
  bcc?: string[];
  attachments?: OutboundAttachment[];
}

export type ComposeResult =
  | { sent: true; threadId: string; messageId: string }
  | {
      sent: false;
      reason:
        | "no-client"
        | "invalid-mailbox"
        | "invalid-to"
        | "invalid-cc"
        | "invalid-bcc"
        | "invalid-attachments"
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

  const ccParsed = parseAddressList(input.cc ?? []);
  if (ccParsed.invalid.length > 0) return { sent: false, reason: "invalid-cc" };
  const bccParsed = parseAddressList(input.bcc ?? []);
  if (bccParsed.invalid.length > 0) return { sent: false, reason: "invalid-bcc" };
  const { cc, bcc } = dedupeRecipients({
    to: [to],
    cc: ccParsed.valid,
    bcc: bccParsed.valid,
  });
  if (exceedsRecipientTotal({ to: [to], cc, bcc })) {
    return { sent: false, reason: "invalid-cc", detail: "Demasiados destinatarios" };
  }

  const attachments = input.attachments ?? [];
  if (!attachmentsAreValid(attachments)) {
    return { sent: false, reason: "invalid-attachments" };
  }

  const subject = input.subject.trim() || "(sin asunto)";
  const bodyText = input.bodyText.trim();
  if (!bodyText) {
    return { sent: false, reason: "empty-body" };
  }
  const stored = prepareStoredEmailBodies(input.bodyHtml, bodyText);

  const client = getResendClient();
  if (!client) {
    return { sent: false, reason: "no-client" };
  }

  const fromMeta = displayFrom(input.mailbox);

  let resendEmailId: string | undefined;
  const outboundMessageId = createOutboundMessageId();
  try {
    const result = await client.emails.send({
      from: fromMeta.from,
      to,
      ...(cc.length > 0 ? { cc } : {}),
      ...(bcc.length > 0 ? { bcc } : {}),
      subject,
      text: stored.text ?? bodyText,
      ...(stored.html ? { html: stored.html } : {}),
      ...(attachments.length > 0
        ? { attachments: toResendAttachments(attachments) }
        : {}),
      headers: {
        "Message-ID": outboundMessageId,
      },
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

  // Resend/SES reescribe Message-ID: guardamos el real (ver thread-match).
  const realMessageId =
    (await fetchSentMessageId(client, resendEmailId)) ?? outboundMessageId;

  const now = new Date().toISOString();

  const { data: thread, error: threadErr } = await admin
    .from("email_threads")
    .insert({
      subject,
      from_address: to,
      from_name: null,
      mailbox_address: input.mailbox,
      lead_id: input.leadId ?? null,
      ...(input.leadId ? { lead_link_source: "manual" } : {}),
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
      message_id: realMessageId,
      in_reply_to: null,
      references: null,
      direction: "outbound",
      from_address: fromMeta.address,
      from_name: fromMeta.name,
      to_addresses: [to],
      cc_addresses: cc,
      bcc_addresses: bcc,
      subject,
      body_html: stored.html,
      body_text: stored.text ?? bodyText,
      send_status: "delivered",
      received_at: now,
    })
    .select("id")
    .single();

  if (msgErr || !msg) {
    return { sent: false, reason: "db-error", detail: msgErr?.message };
  }

  await storeOutboundAttachments(admin, client, {
    messageId: msg.id,
    resendEmailId,
    files: attachments,
  });

  if (!input.leadId) {
    await autoLinkThread(admin, thread.id, [to, ...cc]);
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
