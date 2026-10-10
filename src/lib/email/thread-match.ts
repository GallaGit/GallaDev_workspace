import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resend } from "resend";
import {
  SUBJECT_FALLBACK_DAYS,
  hasReplyPrefix,
  messageIdLookupVariants,
  normalizeMessageId,
  parseMessageIdList,
  pickSubjectMatch,
  type ThreadCandidateMessage,
} from "./threading";

/**
 * Busca el hilo existente de un mensaje entrante, en este orden:
 *  1. In-Reply-To contra email_messages.message_id
 *  2. Cualquier id de References (del más reciente al más antiguo)
 *  3. Asunto normalizado + misma contraparte, mismo buzón, últimos 30 días.
 *     Solo si el mensaje parece respuesta (cabeceras de hilo o prefijo Re:/Fwd:),
 *     para no juntar dos conversaciones nuevas con el mismo asunto.
 */
export interface ThreadMatchInput {
  inReplyTo: string | null;
  references: string | null;
  subject: string | null;
  counterpart: string;
  mailbox: string;
  /** Fecha del mensaje (ISO). La ventana de 30 días cuenta hacia atrás desde aquí. */
  at?: string;
  /** Re-hilado: no devolver el propio hilo. */
  excludeThreadId?: string;
}

export type ThreadMatch =
  | { threadId: string; via: "in-reply-to" | "references" | "subject" }
  | null;

export async function findThreadForMessage(
  admin: SupabaseClient,
  input: ThreadMatchInput,
): Promise<ThreadMatch> {
  const irt = parseMessageIdList(input.inReplyTo);
  const refs = parseMessageIdList(input.references).reverse();

  const byIrt = await lookupByIds(admin, irt, input);
  if (byIrt) return { threadId: byIrt, via: "in-reply-to" };

  const byRefs = await lookupByIds(admin, refs, input);
  if (byRefs) return { threadId: byRefs, via: "references" };

  const looksLikeReply =
    irt.length > 0 || refs.length > 0 || hasReplyPrefix(input.subject);
  if (!looksLikeReply || !input.subject || !input.counterpart) return null;

  const until = input.at ? new Date(input.at) : new Date();
  const since = new Date(until.getTime() - SUBJECT_FALLBACK_DAYS * 86_400_000);
  const cp = input.counterpart.trim().toLowerCase();

  const { data: msgs } = await admin
    .from("email_messages")
    .select("thread_id, subject, from_address, to_addresses, cc_addresses, received_at")
    .or(`from_address.eq.${cp},to_addresses.cs.{${cp}},cc_addresses.cs.{${cp}}`)
    .gte("received_at", since.toISOString())
    .lte("received_at", until.toISOString())
    .order("received_at", { ascending: false })
    .limit(200);

  const candidates = (msgs ?? []) as ThreadCandidateMessage[];
  if (candidates.length === 0) return null;

  const threadIds = Array.from(new Set(candidates.map((m) => m.thread_id)));
  const { data: threads } = await admin
    .from("email_threads")
    .select("id, mailbox_address")
    .in("id", threadIds);
  const sameMailbox = new Set(
    (threads ?? [])
      .filter((t) => t.mailbox_address === input.mailbox)
      .map((t) => t.id as string),
  );

  const picked = pickSubjectMatch(
    candidates.filter((m) => sameMailbox.has(m.thread_id)),
    { subject: input.subject, counterpart: cp, excludeThreadId: input.excludeThreadId },
  );
  return picked ? { threadId: picked, via: "subject" } : null;
}

async function lookupByIds(
  admin: SupabaseClient,
  ids: string[],
  input: ThreadMatchInput,
): Promise<string | null> {
  for (const id of ids) {
    const variants = messageIdLookupVariants([id]);
    if (variants.length === 0) continue;
    const { data } = await admin
      .from("email_messages")
      .select("thread_id, received_at")
      .in("message_id", variants)
      .order("received_at", { ascending: true })
      .limit(5);
    const hit = (data ?? []).find((r) => r.thread_id !== input.excludeThreadId);
    if (hit?.thread_id) return hit.thread_id as string;
  }
  return null;
}

/**
 * Message-ID real de un envío. Resend/SES reescribe la cabecera Message-ID,
 * así que el id que ve el destinatario solo se conoce con `emails.get`.
 * Devuelve null si Resend aún no lo tiene o falla (el llamante usa el propio).
 */
export async function fetchSentMessageId(
  client: Resend,
  resendEmailId: string,
  opts: { attempts?: number; delayMs?: number } = {},
): Promise<string | null> {
  const attempts = opts.attempts ?? 3;
  const delayMs = opts.delayMs ?? 400;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await client.emails.get(resendEmailId);
      const raw = res.data?.message_id?.trim();
      if (raw && normalizeMessageId(raw)) {
        return raw.startsWith("<") ? raw : `<${raw}>`;
      }
    } catch {
      // reintento
    }
    if (i < attempts - 1 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
}
