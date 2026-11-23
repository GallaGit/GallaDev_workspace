import type { LeadLinkBackfillOptions } from "./lead-link-backfill";

export type BackfillBodyResult =
  | { ok: true; value: LeadLinkBackfillOptions }
  | { ok: false; error: string };

const ALLOWED = new Set(["dryRun", "limit", "offset"]);

/** Valida el body opcional del backfill: { dryRun?, limit?, offset? }. */
export function parseBackfillLeadLinksBody(raw: unknown): BackfillBodyResult {
  if (raw == null) return { ok: true, value: {} };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Datos no válidos" };
  }
  const body = raw as Record<string, unknown>;
  if (Object.keys(body).some((key) => !ALLOWED.has(key))) {
    return { ok: false, error: "Campo no permitido" };
  }

  const value: LeadLinkBackfillOptions = {};
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
