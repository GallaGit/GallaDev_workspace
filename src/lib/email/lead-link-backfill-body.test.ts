import { describe, expect, it } from "vitest";
import { parseBackfillLeadLinksBody } from "./lead-link-backfill-body";

describe("parseBackfillLeadLinksBody", () => {
  it("acepta cuerpo vacío", () => {
    expect(parseBackfillLeadLinksBody(undefined)).toEqual({ ok: true, value: {} });
    expect(parseBackfillLeadLinksBody({})).toEqual({ ok: true, value: {} });
  });

  it("acepta dryRun, limit y offset", () => {
    expect(
      parseBackfillLeadLinksBody({ dryRun: true, limit: 50, offset: 10 }),
    ).toEqual({ ok: true, value: { dryRun: true, limit: 50, offset: 10 } });
  });

  it("rechaza tipos incorrectos y campos desconocidos", () => {
    expect(parseBackfillLeadLinksBody({ dryRun: "si" }).ok).toBe(false);
    expect(parseBackfillLeadLinksBody({ limit: "5" }).ok).toBe(false);
    expect(parseBackfillLeadLinksBody({ offset: Infinity }).ok).toBe(false);
    expect(parseBackfillLeadLinksBody({ lead_id: "x" })).toEqual({
      ok: false,
      error: "Campo no permitido",
    });
    expect(parseBackfillLeadLinksBody([1]).ok).toBe(false);
    expect(parseBackfillLeadLinksBody("x").ok).toBe(false);
  });
});
