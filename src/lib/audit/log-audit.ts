import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isVisitorRequest } from "@/lib/demo/visitor-request";
import type { AppRole } from "@/lib/auth";
import { isAuthDisabled } from "@/lib/auth";
import type { AuditAction, AuditDiff } from "./audit-diff";
import { auditFieldNames } from "./audit-diff";

export { auditFieldNames } from "./audit-diff";
export type { AuditAction } from "./audit-diff";

/** Actor tomado SIEMPRE de la sesión del servidor, nunca del cliente. */
export interface AuditActor {
  id: string;
  email: string | null;
  role: AppRole | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Inserta una fila en `audit_log` con service_role (el rol de la app no
 * tiene INSERT). Un fallo se registra en log y no rompe la mutación.
 */
export async function logAudit(entry: {
  actor: AuditActor;
  action: AuditAction;
  entity: string;
  entityId: string;
  diff?: AuditDiff;
  /** Atajo: solo nombres de campo. */
  changedFields?: readonly string[];
}): Promise<void> {
  try {
    if (isAuthDisabled()) return;
    if (await isVisitorRequest()) return;

    const diff: AuditDiff = entry.diff ?? {
      fields: auditFieldNames(entry.changedFields),
    };
    const sb = createSupabaseAdminClient();
    const { error } = await sb.from("audit_log").insert({
      actor_id: entry.actor.id,
      actor_email: entry.actor.email,
      actor_role: entry.actor.role,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId,
      lead_id:
        entry.entity === "lead" && UUID_RE.test(entry.entityId)
          ? entry.entityId
          : null,
      diff,
    });

    if (error) {
      console.error("[audit] insert failed:", error.message);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[audit] error:", message);
  }
}
