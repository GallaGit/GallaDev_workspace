import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { errorClassOf, logRouteError } from "@/lib/route-log";
import {
  externalAddresses,
  resolveLeadMatch,
  type LeadEmailRow,
  type LeadMatch,
} from "./lead-match";

/**
 * Vinculación automática hilo ↔ lead (service_role; ignora RLS).
 *
 * Reglas:
 *  - Solo si el hilo no tiene lead y nadie lo desvinculó a mano
 *    (`lead_link_source = 'manual'` con `lead_id` nulo).
 *  - Se buscan leads activos cuyo email (principal, comercial o responsable)
 *    coincida, normalizado, con alguna dirección externa.
 *  - Exactamente un lead → se vincula con origen `auto`. Varios → no se vincula.
 *  - El UPDATE es condicional: nunca pisa una vinculación manual concurrente.
 *  - Nunca lanza: un fallo aquí no debe tumbar el webhook ni el envío.
 */

const ROUTE = "email-lead-link";
const MAX_ADDRESSES = 10;
const MAX_CANDIDATE_ROWS = 50;
const LEAD_EMAIL_COLUMNS = ["email", "email_commercial", "email_manager"] as const;

export type AutoLinkSkipReason =
  | "no-addresses"
  | "thread-not-found"
  | "already-linked"
  | "manual-unlinked"
  | "no-match"
  | "ambiguous"
  | "error";

export type AutoLinkResult =
  | { status: "linked"; leadId: string; dryRun: boolean }
  | { status: "skipped"; reason: AutoLinkSkipReason };

/**
 * Patrón ILIKE amplio para preseleccionar en BD; la comparación exacta
 * (minúsculas, sin espacios) se repite en memoria. `%`, `_`, `\` y `"`
 * pasan a comodín para no tener que escaparlos en el filtro de PostgREST.
 */
function candidatePattern(address: string): string {
  return `%${address.replace(/[%_\\"]/g, "%")}%`;
}

export async function findLeadMatch(
  admin: SupabaseClient,
  addresses: readonly string[],
): Promise<LeadMatch> {
  const wanted = addresses.slice(0, MAX_ADDRESSES);
  if (wanted.length === 0) return { status: "none" };

  const conditions = LEAD_EMAIL_COLUMNS.flatMap((column) =>
    wanted.map((address) => `${column}.ilike."${candidatePattern(address)}"`),
  );
  const { data, error } = await admin
    .from("leads")
    .select("id, email, email_commercial, email_manager")
    .eq("archived", false)
    .or(conditions.join(","))
    .limit(MAX_CANDIDATE_ROWS);
  if (error) throw error;
  return resolveLeadMatch(wanted, (data ?? []) as LeadEmailRow[]);
}

export async function autoLinkThread(
  admin: SupabaseClient,
  threadId: string,
  rawAddresses: ReadonlyArray<string | null | undefined>,
  opts: { dryRun?: boolean } = {},
): Promise<AutoLinkResult> {
  try {
    const addresses = externalAddresses(rawAddresses);
    if (addresses.length === 0) return { status: "skipped", reason: "no-addresses" };

    const { data: thread, error: threadErr } = await admin
      .from("email_threads")
      .select("lead_id, lead_link_source")
      .eq("id", threadId)
      .maybeSingle();
    if (threadErr) throw threadErr;
    if (!thread) return { status: "skipped", reason: "thread-not-found" };
    if (thread.lead_id) return { status: "skipped", reason: "already-linked" };
    if (thread.lead_link_source === "manual") {
      return { status: "skipped", reason: "manual-unlinked" };
    }

    const match = await findLeadMatch(admin, addresses);
    if (match.status === "none") return { status: "skipped", reason: "no-match" };
    if (match.status === "ambiguous") {
      return { status: "skipped", reason: "ambiguous" };
    }

    if (opts.dryRun) {
      return { status: "linked", leadId: match.leadId, dryRun: true };
    }

    const { data: updated, error: updateErr } = await admin
      .from("email_threads")
      .update({ lead_id: match.leadId, lead_link_source: "auto" })
      .eq("id", threadId)
      .is("lead_id", null)
      .or("lead_link_source.is.null,lead_link_source.eq.auto")
      .select("id");
    if (updateErr) throw updateErr;
    if (!updated || updated.length === 0) {
      return { status: "skipped", reason: "already-linked" };
    }
    return { status: "linked", leadId: match.leadId, dryRun: false };
  } catch (e) {
    logRouteError({ route: ROUTE, errorClass: errorClassOf(e) }, "warn");
    return { status: "skipped", reason: "error" };
  }
}
