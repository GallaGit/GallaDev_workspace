import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { autoLinkThread, type AutoLinkSkipReason } from "./lead-link";

/**
 * Backfill de vinculación hilo ↔ lead sobre hilos existentes (Admin).
 *
 * Solo recorre hilos sin lead y sin decisión manual previa
 * (`lead_id IS NULL AND lead_link_source IS NULL`) y aplica la misma regla
 * que el webhook (un único lead coincidente). Idempotente: lo ya vinculado
 * deja de entrar en el recorrido y repetirlo no cambia nada.
 *
 * dryRun: informa qué vincularía, sin escribir.
 * offset: salta N hilos sin vincular (los ya revisados sin coincidencia, que
 * siguen sin lead); `nextOffset` indica por dónde continuar.
 */

export interface LeadLinkBackfillOptions {
  dryRun?: boolean;
  /** Hilos a revisar por llamada (1–500, defecto 200). */
  limit?: number;
  offset?: number;
}

export interface LeadLinkBackfillResult {
  dryRun: boolean;
  threadsScanned: number;
  linked: { threadId: string; leadId: string }[];
  ambiguous: number;
  noMatch: number;
  skipped: number;
  /** Siguiente offset para continuar; null si ya no quedan hilos por revisar. */
  nextOffset: number | null;
}

type ThreadAddressRow = {
  from_address: string | null;
  to_addresses: string[] | null;
  cc_addresses: string[] | null;
};

const MAX_LIMIT = 500;

export async function backfillLeadLinks(
  admin: SupabaseClient,
  opts: LeadLinkBackfillOptions = {},
): Promise<LeadLinkBackfillResult> {
  const dryRun = opts.dryRun === true;
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 200), 1), MAX_LIMIT);
  const offset = Math.max(Math.trunc(opts.offset ?? 0), 0);

  const result: LeadLinkBackfillResult = {
    dryRun,
    threadsScanned: 0,
    linked: [],
    ambiguous: 0,
    noMatch: 0,
    skipped: 0,
    nextOffset: null,
  };

  const { data: threads, error } = await admin
    .from("email_threads")
    .select("id")
    .is("lead_id", null)
    .is("lead_link_source", null)
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;

  // Tras una pasada real siguen sin lead los que no coinciden, son ambiguos o
  // fallaron; en dryRun no se escribe nada y siguen todos.
  const STAYS_UNLINKED: AutoLinkSkipReason[] = [
    "ambiguous",
    "no-match",
    "no-addresses",
    "error",
  ];
  let remaining = 0;

  for (const thread of threads ?? []) {
    result.threadsScanned += 1;
    const { data: messages } = await admin
      .from("email_messages")
      .select("from_address, to_addresses, cc_addresses")
      .eq("thread_id", thread.id);

    const addresses = ((messages ?? []) as ThreadAddressRow[]).flatMap((m) => [
      m.from_address,
      ...(m.to_addresses ?? []),
      ...(m.cc_addresses ?? []),
    ]);
    const outcome = await autoLinkThread(admin, String(thread.id), addresses, {
      dryRun,
    });

    if (dryRun) remaining += 1;
    if (outcome.status === "linked") {
      result.linked.push({ threadId: String(thread.id), leadId: outcome.leadId });
      continue;
    }
    if (!dryRun && STAYS_UNLINKED.includes(outcome.reason)) remaining += 1;
    if (outcome.reason === "ambiguous") result.ambiguous += 1;
    else if (outcome.reason === "no-match" || outcome.reason === "no-addresses") {
      result.noMatch += 1;
    } else result.skipped += 1;
  }

  if ((threads ?? []).length === limit) {
    result.nextOffset = offset + remaining;
  }
  return result;
}
