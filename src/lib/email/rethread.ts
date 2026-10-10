import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resend } from "resend";
import { findThreadForMessage, fetchSentMessageId } from "./thread-match";

/**
 * Re-hilado de hilos partidos (Admin, idempotente).
 *
 * Paso 1: corrige message_id de mensajes salientes que guardaron nuestro id
 *   `<uuid@galladev.com>` (Resend/SES lo reescribe) con el real de `emails.get`.
 * Paso 2: recorre hilos del más antiguo al más nuevo. Si el primer mensaje de
 *   un hilo es entrante y el matcher (In-Reply-To → References → asunto +
 *   contraparte, 30 días, mismo buzón) encuentra OTRO hilo anterior, mueve
 *   todos sus mensajes a ese hilo, recalcula contadores y borra el hilo vacío.
 *
 * Repetirlo no cambia nada (lo ya fusionado ya no tiene hilo propio).
 * dryRun: solo informa, no escribe.
 */

export interface RethreadOptions {
  dryRun?: boolean;
  /** Máximo de hilos a revisar (1–1000, defecto 500). */
  limit?: number;
}

export interface RethreadResult {
  dryRun: boolean;
  outboundIdsFixed: number;
  threadsScanned: number;
  merged: { from: string; into: string; via: string; messages: number }[];
}

const OWN_ID_SUFFIX = "@galladev.com>";

export async function rethreadSplitThreads(
  admin: SupabaseClient,
  client: Resend | null,
  opts: RethreadOptions = {},
): Promise<RethreadResult> {
  const dryRun = opts.dryRun === true;
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 500), 1), 1000);
  const result: RethreadResult = {
    dryRun,
    outboundIdsFixed: 0,
    threadsScanned: 0,
    merged: [],
  };

  // Paso 1
  if (client) {
    const { data: outbound } = await admin
      .from("email_messages")
      .select("id, resend_email_id, message_id")
      .eq("direction", "outbound")
      .like("message_id", `%${OWN_ID_SUFFIX}`)
      .limit(limit);
    for (const m of outbound ?? []) {
      const real = await fetchSentMessageId(client, String(m.resend_email_id), {
        attempts: 1,
        delayMs: 0,
      });
      if (!real || real === m.message_id) continue;
      if (!dryRun) {
        await admin.from("email_messages").update({ message_id: real }).eq("id", m.id);
      }
      result.outboundIdsFixed += 1;
    }
  }

  // Paso 2
  const { data: threads } = await admin
    .from("email_threads")
    .select("id, mailbox_address, lead_id, is_read, created_at")
    .order("created_at", { ascending: true })
    .limit(limit);

  const removed = new Set<string>();
  for (const thread of threads ?? []) {
    if (removed.has(thread.id)) continue;
    result.threadsScanned += 1;

    const { data: first } = await admin
      .from("email_messages")
      .select("id, direction, from_address, subject, in_reply_to, references, received_at")
      .eq("thread_id", thread.id)
      .order("received_at", { ascending: true })
      .limit(1);
    const m = first?.[0];
    if (!m || m.direction !== "inbound") continue;

    const match = await findThreadForMessage(admin, {
      inReplyTo: m.in_reply_to,
      references: m.references,
      subject: m.subject,
      counterpart: String(m.from_address),
      mailbox: String(thread.mailbox_address),
      at: m.received_at,
      excludeThreadId: thread.id,
    });
    if (!match || removed.has(match.threadId)) continue;

    // Solo fusionar hacia un hilo con mensajes anteriores (evita ciclos).
    const { data: targetFirst } = await admin
      .from("email_messages")
      .select("received_at")
      .eq("thread_id", match.threadId)
      .order("received_at", { ascending: true })
      .limit(1);
    const tAt = targetFirst?.[0]?.received_at;
    if (!tAt || tAt > m.received_at) continue;

    const { count } = await admin
      .from("email_messages")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", thread.id);

    result.merged.push({
      from: thread.id,
      into: match.threadId,
      via: match.via,
      messages: count ?? 0,
    });
    if (dryRun) {
      removed.add(thread.id);
      continue;
    }

    await mergeThreadInto(admin, thread, match.threadId);
    removed.add(thread.id);
  }

  return result;
}

async function mergeThreadInto(
  admin: SupabaseClient,
  source: { id: string; lead_id: string | null; is_read: boolean },
  targetId: string,
): Promise<void> {
  await admin.from("email_messages").update({ thread_id: targetId }).eq("thread_id", source.id);

  const { data: target } = await admin
    .from("email_threads")
    .select("lead_id, is_read")
    .eq("id", targetId)
    .single();

  const { data: last } = await admin
    .from("email_messages")
    .select("received_at")
    .eq("thread_id", targetId)
    .order("received_at", { ascending: false })
    .limit(1);
  const { count } = await admin
    .from("email_messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", targetId);

  const patch: Record<string, unknown> = {
    message_count: count ?? 0,
    is_read: Boolean(target?.is_read) && Boolean(source.is_read),
  };
  if (last?.[0]?.received_at) patch.last_message_at = last[0].received_at;
  if (!target?.lead_id && source.lead_id) patch.lead_id = source.lead_id;
  await admin.from("email_threads").update(patch).eq("id", targetId);

  // Hilo ya vacío (los mensajes se movieron). Borradores de respuesta caen por CASCADE.
  await admin.from("email_threads").delete().eq("id", source.id);
}
