import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AuditEntry } from "./types";

const COLUMNS =
  "id, created_at, actor_id, actor_email, actor_role, action, entity, entity_id, lead_id, diff";

export const AUDIT_ACTION_RE = /^[a-z][a-z_]*(\.[a-z][a-z_]*)?$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface AuditQuery {
  leadId?: string;
  actorId?: string;
  action?: string;
  /** YYYY-MM-DD, inclusivo, en UTC. */
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export function parseAuditQuery(
  params: URLSearchParams,
  pageSize: number,
): AuditQuery {
  const actor = params.get("actor") ?? "";
  const action = params.get("action") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const page = Math.max(1, Math.floor(Number(params.get("page"))) || 1);
  return {
    actorId: UUID_RE.test(actor) ? actor : undefined,
    action: AUDIT_ACTION_RE.test(action) ? action : undefined,
    from: DATE_RE.test(from) ? from : undefined,
    to: DATE_RE.test(to) ? to : undefined,
    page: Math.min(page, 10_000),
    pageSize,
  };
}

/**
 * Consulta con el cliente del usuario: la visibilidad la decide RLS
 * (Admin todo; Seller/Viewer solo eventos de leads que pueden ver).
 */
export async function queryAudit(
  sb: SupabaseClient,
  q: AuditQuery,
): Promise<{ entries: AuditEntry[]; total: number }> {
  let query = sb
    .from("audit_log")
    .select(COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (q.leadId) query = query.eq("lead_id", q.leadId);
  if (q.actorId) query = query.eq("actor_id", q.actorId);
  if (q.action) query = query.eq("action", q.action);
  if (q.from) query = query.gte("created_at", `${q.from}T00:00:00.000Z`);
  if (q.to) query = query.lte("created_at", `${q.to}T23:59:59.999Z`);
  const start = (q.page - 1) * q.pageSize;
  const { data, error, count } = await query.range(start, start + q.pageSize - 1);
  if (error) throw new Error(error.message);
  return { entries: (data ?? []) as AuditEntry[], total: count ?? 0 };
}

/** Etiquetas (correo) de los responsables citados en los diffs. Solo Admin. */
export async function resolveAuditLabels(
  entries: readonly AuditEntry[],
  viewer: SessionUser,
): Promise<Record<string, string>> {
  if (viewer.role !== "Admin") return {};
  const ids = new Set<string>();
  for (const e of entries) {
    const change = e.diff?.changes?.responsibleId;
    for (const v of [change?.from, change?.to]) {
      if (typeof v === "string" && UUID_RE.test(v)) ids.add(v);
    }
    if (e.entity === "profile" && UUID_RE.test(e.entity_id)) ids.add(e.entity_id);
  }
  if (ids.size === 0) return {};
  const labels: Record<string, string> = {};
  try {
    const admin = createSupabaseAdminClient();
    await Promise.all(
      [...ids].map(async (id) => {
        const { data } = await admin.auth.admin.getUserById(id);
        if (data?.user?.email) labels[id] = data.user.email;
      }),
    );
  } catch {
    return labels;
  }
  return labels;
}
