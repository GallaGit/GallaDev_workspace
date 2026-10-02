import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  defaultMailbox,
  displayFrom,
  isCompanyMailbox,
} from "./mailboxes";
import { getResendClient } from "./resend-client";
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

export interface ReplyInput {
  threadId: string;
  bodyText: string;
  bodyHtml?: string;
}

export type ReplyResult =
  | { sent: true; messageId: string }
  | { sent: false; reason: "no-client" | "no-thread" | "send-failed" | "db-error"; detail?: string };

export async function sendReply(
  admin: SupabaseClient,
  input: ReplyInput,
): Promise<ReplyResult> {
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
  const mailbox = isCompanyMailbox(rawMailbox) ? rawMailbox : defaultMailbox();
  const fromMeta = displayFrom(mailbox);

  const { data: messages } = await admin
    .from("email_messages")
    .select("message_id, direction, from_address, to_addresses")
    .eq("thread_id", input.threadId)
    .order("received_at", { ascending: true });

  const threadMessages = messages ?? [];

  const lastInbound = [...threadMessages]
    .reverse()
    .find((m) => m.direction === "inbound");

  const replyTo = lastInbound?.from_address ?? thread.from_address;

  const allMessageIds = threadMessages
    .map((m) => m.message_id)
    .filter((id): id is string => Boolean(id));

  const inReplyTo = allMessageIds.length > 0 ? allMessageIds[allMessageIds.length - 1] : undefined;
  const references = allMessageIds.length > 0 ? allMessageIds.join(" ") : undefined;

  const subject = thread.subject.startsWith("Re:")
    ? thread.subject
    : `Re: ${thread.subject}`;

  const stored = prepareStoredEmailBodies(input.bodyHtml, input.bodyText);

  let resendEmailId: string | undefined;
  let resendMessageId: string | undefined;

  try {
    const result = await client.emails.send({
      from: fromMeta.from,
      to: replyTo,
      subject,
      text: stored.text ?? input.bodyText,
      ...(stored.html ? { html: stored.html } : {}),
      headers: {
        ...(inReplyTo ? { "In-Reply-To": inReplyTo } : {}),
        ...(references ? { References: references } : {}),
      },
    });

    if (result.error) {
      return { sent: false, reason: "send-failed", detail: result.error.message };
    }

    resendEmailId = result.data?.id;
    resendMessageId = undefined;
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

  const { data: msg, error: dbErr } = await admin
    .from("email_messages")
    .insert({
      thread_id: input.threadId,
      resend_email_id: resendEmailId,
      message_id: resendMessageId ?? null,
      in_reply_to: inReplyTo ?? null,
      references: references ?? null,
      direction: "outbound",
      from_address: fromMeta.address,
      from_name: fromMeta.name,
      to_addresses: [replyTo],
      cc_addresses: [],
      bcc_addresses: [],
      subject,
      body_html: stored.html,
      body_text: stored.text ?? input.bodyText,
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
