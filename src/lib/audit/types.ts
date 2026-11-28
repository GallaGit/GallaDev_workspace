import type { AuditDiff } from "./audit-diff";

export interface AuditEntry {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity: string;
  entity_id: string;
  lead_id: string | null;
  diff: AuditDiff;
}

export interface AuditListResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  /** Id del usuario que consulta (para mostrar «Tú»). */
  viewerId: string | null;
  /** uuid → etiqueta legible. Solo se rellena para Admin. */
  labels: Record<string, string>;
}

export const AUDIT_PAGE_SIZE = 25;
export const LEAD_HISTORY_LIMIT = 50;
