import { describe, expect, it } from "vitest";
import { parseImportLegacyLeadDraftsBody } from "./import-legacy-lead-drafts-body";

describe("parseImportLegacyLeadDraftsBody", () => {
  it("acepta vacío y los campos conocidos", () => {
    expect(parseImportLegacyLeadDraftsBody(undefined)).toEqual({ ok: true, value: {} });
    expect(
      parseImportLegacyLeadDraftsBody({ dryRun: true, limit: 10, offset: 5 }),
    ).toEqual({ ok: true, value: { dryRun: true, limit: 10, offset: 5 } });
  });

  it("rechaza campos o tipos no válidos", () => {
    expect(parseImportLegacyLeadDraftsBody({ extra: 1 })).toMatchObject({
      ok: false,
      error: "Campo no permitido",
    });
    expect(parseImportLegacyLeadDraftsBody({ dryRun: "sí" })).toMatchObject({
      ok: false,
      error: "dryRun debe ser sí o no",
    });
    expect(parseImportLegacyLeadDraftsBody({ limit: "10" })).toMatchObject({
      ok: false,
    });
  });
});
