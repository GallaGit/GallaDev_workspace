import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isVisitorRequest } from "@/lib/demo/visitor-request";

export type AuditAction = "create" | "update" | "delete" | "role_change";

export async function logAudit(entry: {
  actorId: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  diff?: Record<string, unknown>;
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
      diff: entry.diff ?? {},
    });

    if (error) {
      console.warn("[audit] insert failed:", error.message);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn("[audit] error:", message);
  }
}
