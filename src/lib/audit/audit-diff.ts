import type { LeadPatch } from "@/lib/domain/lead";

/**
 * Acciones del historial. Convención `entidad.verbo` en minúsculas.
 * Los valores antiguos (create, update, delete, role_change) siguen
 * existiendo en filas previas y la UI los muestra tal cual.
 */
export const AUDIT_ACTIONS = [
  "lead.created",
  "lead.status_changed",
  "lead.reassigned",
  "lead.note_edited",
  "lead.updated",
  "lead.archived",
  "team.role_changed",
  "settings.changed",
  "auth.login",
  "auth.logout",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditScalar = string | number | boolean | null;

export interface AuditDiff {
  /** Nombres de campo afectados (siempre presente). */
  fields: string[];
  /** Antes → después solo para campos no sensibles. */
  changes?: Record<string, { from: AuditScalar; to: AuditScalar }>;
}

/**
 * Lista cerrada de campos de lead cuyo valor puede guardarse.
 * Todo lo demás (email, teléfono, notas, mensajes, web, dirección...)
 * guarda solo el nombre del campo.
 */
export const LEAD_SAFE_FIELDS = [
  "status",
  "responsibleId",
  "favorite",
  "archived",
  "score",
  "confidence",
  "lastContact",
  "nextFollowUp",
] as const;

const MAX_VALUE_LENGTH = 120;

/** Nombres únicos, ordenados y acotados (nunca valores). */
export function auditFieldNames(fields: readonly string[] | undefined): string[] {
  if (!fields) return [];
  return Array.from(
    new Set(fields.filter((f) => typeof f === "string" && f.length > 0 && f.length <= 64)),
  ).sort();
}

function scalar(value: unknown): AuditScalar {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.slice(0, MAX_VALUE_LENGTH);
  return null;
}

/**
 * Construye el diff guardando antes→después solo de `safeFields`.
 * `before` y `after` pueden ser parciales; se comparan por campo.
 */
export function buildAuditDiff(
  changedFields: readonly string[],
  safeFields: readonly string[],
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown>,
): AuditDiff {
  const fields = auditFieldNames(changedFields);
  const changes: NonNullable<AuditDiff["changes"]> = {};
  for (const field of fields) {
    if (!safeFields.includes(field)) continue;
    changes[field] = { from: scalar(before?.[field]), to: scalar(after[field]) };
  }
  return Object.keys(changes).length > 0 ? { fields, changes } : { fields };
}

export function leadUpdateDiff(
  before: Record<string, unknown> | null | undefined,
  patch: LeadPatch,
): AuditDiff {
  return buildAuditDiff(
    Object.keys(patch),
    LEAD_SAFE_FIELDS,
    before,
    patch as Record<string, unknown>,
  );
}

/** Una sola acción por mutación: estado > reasignación > nota > resto. */
export function leadUpdateAction(patch: LeadPatch): AuditAction {
  const keys = Object.keys(patch);
  if (keys.includes("status")) return "lead.status_changed";
  if (keys.includes("responsibleId")) return "lead.reassigned";
  if (keys.some((k) => k === "notes" || k === "notesOverflow")) {
    return "lead.note_edited";
  }
  return "lead.updated";
}
