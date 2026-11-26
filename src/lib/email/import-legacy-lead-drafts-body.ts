import type { ImportLegacyLeadDraftsOptions } from "./import-legacy-lead-drafts";

export type ImportLegacyBodyResult =
  | { ok: true; value: ImportLegacyLeadDraftsOptions }
  | { ok: false; error: string };

const ALLOWED = new Set(["dryRun", "limit", "offset"]);

/** Valida el body opcional: { dryRun?, limit?, offset? }. dryRun por defecto true. */
export function parseImportLegacyLeadDraftsBody(
  raw: unknown,
): ImportLegacyBodyResult {
  if (raw == null) return { ok: true, value: {} };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Datos no válidos" };
  }
  const body = raw as Record<string, unknown>;
  if (Object.keys(body).some((key) => !ALLOWED.has(key))) {
    return { ok: false, error: "Campo no permitido" };
  }

  const value: ImportLegacyLeadDraftsOptions = {};
  if (body.dryRun !== undefined) {
    if (typeof body.dryRun !== "boolean") {
      return { ok: false, error: "dryRun debe ser sí o no" };
    }
    value.dryRun = body.dryRun;
  }
  for (const key of ["limit", "offset"] as const) {
    const v = body[key];
    if (v === undefined) continue;
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return { ok: false, error: `${key} debe ser un número` };
    }
    value[key] = v;
  }
  return { ok: true, value };
}
