import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  displayFrom,
  extractEmailAddress,
  isCompanyMailbox,
  isValidExternalEmail,
} from "./mailboxes";
import { MAX_EMAIL_BODY_CHARS } from "./limits";
import { createOutboundMessageId } from "./receiving-fetch";
import { getResendClient } from "./resend-client";
import { fetchSentMessageId } from "./thread-match";
import { replyAllRecipients, replySubject } from "./threading";
import { prepareStoredEmailBodies } from "./sanitize-email-html";

/**
 * Envía una respuesta en un hilo y guarda el mensaje saliente.
 *
 * Threading RFC 2822:
 *  - In-Reply-To: message_id del último mensaje al que se contesta.
 *  - References: todos los message_id del hilo + el de arriba, separados por espacio.
 *  - Subject: "Re: <asunto original>" (sin apilar Re:).
 *  - From: el mailbox_address del hilo (hola@ u ociel@).
 */

export type ReplyMode = "reply" | "replyAll";

export interface ReplyInput {
  threadId: string;
  bodyText: string;
  bodyHtml?: string;
  /** "replyAll": To + Cc del último mensaje, sin nuestros buzones. */
  mode?: ReplyMode;
}

export type ReplyResult =
  | { sent: true; messageId: string }
  | {
      sent: false;
      reason:
        | "no-client"
        | "no-thread"
        | "invalid-body"
        | "invalid-mailbox"
        | "invalid-recipient"
        | "send-failed"
        | "db-error";
      detail?: string;
    };

export async function sendReply(
  admin: SupabaseClient,
  input: ReplyInput,
): Promise<ReplyResult> {
  const bodyText = input.bodyText.trim();
  if (
    !bodyText ||
    bodyText.length > MAX_EMAIL_BODY_CHARS ||
    (input.bodyHtml != null && input.bodyHtml.length > MAX_EMAIL_BODY_CHARS)
  ) {
    return { sent: false, reason: "invalid-body" };
  }

  const client = getResendClient();
  if (!client) {
    return { sent: false, reason: "no-client" };
  }

  const { data: thread } = await admin
    .from("email_threads")
    .select("id, subject, from_address, mailbox_address")
    .eq("id", input.threadId)
    .single();

  if (!thread) {
    return { sent: false, reason: "no-thread" };
  }

  const rawMailbox = String(thread.mailbox_address ?? "");
  if (!isCompanyMailbox(rawMailbox)) {
    return { sent: false, reason: "invalid-mailbox" };
  }
  const fromMeta = displayFrom(rawMailbox);

  const { data: messages } = await admin
    .from("email_messages")
    .select("message_id, direction, from_address, to_addresses, cc_addresses")
    .eq("thread_id", input.threadId)
    .order("received_at", { ascending: true });

  const threadMessages = messages ?? [];

  const lastInbound = [...threadMessages]
    .reverse()
    .find((m) => m.direction === "inbound");

  const rawReplyTo = String(lastInbound?.from_address ?? thread.from_address ?? "");
  if (!isValidExternalEmail(rawReplyTo)) {
    return { sent: false, reason: "invalid-recipient" };
  }
  const replyTo = extractEmailAddress(rawReplyTo);

  let toList: string[] = [replyTo];
  let ccList: string[] = [];
  const lastMessage = threadMessages[threadMessages.length - 1];
  if (input.mode === "replyAll" && lastMessage) {
    const all = replyAllRecipients(
      {
        from_address: String(lastMessage.from_address ?? ""),
        to_addresses: (lastMessage.to_addresses as string[] | null) ?? [],
        cc_addresses: (lastMessage.cc_addresses as string[] | null) ?? [],
        direction: String(lastMessage.direction),
      },
      (a) => isCompanyMailbox(extractEmailAddress(a)),
    );
    const valid = (l: string[]) =>
      l.filter(isValidExternalEmail).map(extractEmailAddress);
    if (all.to.length > 0) {
      toList = valid(all.to);
      ccList = valid(all.cc).filter((a) => !toList.includes(a));
    }
    if (toList.length === 0) {
      return { sent: false, reason: "invalid-recipient" };
    }
  }

  const allMessageIds = threadMessages
    .map((m) => m.message_id)
    .filter((id): id is string => Boolean(id));

  const inReplyTo = allMessageIds.length > 0 ? allMessageIds[allMessageIds.length - 1] : undefined;
  const references = allMessageIds.length > 0 ? allMessageIds.join(" ") : undefined;

  const subject = replySubject(thread.subject);

  const stored = prepareStoredEmailBodies(input.bodyHtml, bodyText);

  let resendEmailId: string | undefined;
  // Resend send() only returns its own id, not the RFC Message-ID. Set ours
  // so a later inbound reply's In-Reply-To can join this thread.
  const outboundMessageId = createOutboundMessageId();

  try {
    const result = await client.emails.send({
      from: fromMeta.from,
      to: toList.length === 1 ? toList[0] : toList,
      ...(ccList.length > 0 ? { cc: ccList } : {}),
      subject,
      text: stored.text ?? bodyText,
      ...(stored.html ? { html: stored.html } : {}),
      headers: {
        "Message-ID": outboundMessageId,
        ...(inReplyTo ? { "In-Reply-To": inReplyTo } : {}),
        ...(references ? { References: references } : {}),
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

  // Resend/SES reescribe Message-ID: guardamos el que ve el destinatario
  // para que su In-Reply-To encuentre este hilo.
  const realMessageId =
    (await fetchSentMessageId(client, resendEmailId)) ?? outboundMessageId;

  const { data: msg, error: dbErr } = await admin
    .from("email_messages")
    .insert({
      thread_id: input.threadId,
      resend_email_id: resendEmailId,
      message_id: realMessageId,
      in_reply_to: inReplyTo ?? null,
      references: references ?? null,
      direction: "outbound",
      from_address: fromMeta.address,
      from_name: fromMeta.name,
      to_addresses: toList,
      cc_addresses: ccList,
      bcc_addresses: [],
      subject,
      body_html: stored.html,
      body_text: stored.text ?? bodyText,
      send_status: "delivered",
      received_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (dbErr || !msg) {
    return { sent: false, reason: "db-error", detail: dbErr?.message };
  }

  const { count } = await admin
    .from("email_messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", input.threadId);

  await admin
    .from("email_threads")
    .update({
      last_message_at: new Date().toISOString(),
      message_count: count ?? 1,
    })
    .eq("id", input.threadId);

  return { sent: true, messageId: msg.id };
}
