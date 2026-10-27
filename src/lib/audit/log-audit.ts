import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isVisitorRequest } from "@/lib/demo/visitor-request";

/** Sanitize to a sorted, de-duplicated list of field names (never values). */
export function auditFieldNames(fields: readonly string[] | undefined): string[] {
  if (!fields) return [];
  return Array.from(
    new Set(fields.filter((f) => typeof f === "string" && f.length > 0 && f.length <= 64)),
  ).sort();
}

export type AuditAction = "create" | "update" | "delete" | "role_change";

export async function logAudit(entry: {
  actorId: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  /** Names of changed fields only. Values are never stored (no PII). */
  changedFields?: readonly string[];
}): Promise<void> {
  try {
    if (process.env.AUTH_DISABLED === "true") {
      return;
    }
    if (await isVisitorRequest()) {
      return;
    }

    const sb = await createSupabaseServerClient();
    const { error } = await sb.from("audit_log").insert({
      actor_id: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId,
      diff: { fields: auditFieldNames(entry.changedFields) },
    });

    if (error) {
      console.warn("[audit] insert failed:", error.message);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn("[audit] error:", message);
  }
}
