import type { AuditEntry } from "./types";
import type { AuditScalar } from "./audit-diff";

export interface AuditChangeView {
  field: string;
  from?: AuditScalar;
  to?: AuditScalar;
  /** false = solo se guarda el nombre del campo (dato sensible o texto libre). */
  hasValues: boolean;
}

/** Cambios listos para pintar: con antes→después o solo el nombre del campo. */
export function auditChangeViews(entry: AuditEntry): AuditChangeView[] {
  const changes = entry.diff?.changes ?? {};
  const fields = Array.isArray(entry.diff?.fields) ? entry.diff.fields : [];
  return fields.map((field) => {
    const c = changes[field];
    return c
      ? { field, from: c.from, to: c.to, hasValues: true }
      : { field, hasValues: false };
  });
}
