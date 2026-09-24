import { describe, expect, it } from "vitest";
import {
  BULK_PATCH_REQUIRED,
  INVALID_LEAD_PATCH,
  validateBulkLeadPatch,
  validateLeadPatch,
} from "@/lib/leads/validate-lead-patch";

describe("validateLeadPatch", () => {
  it("accepts a partial status patch and returns it unchanged", () => {
    const result = validateLeadPatch({ status: "Validado" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ status: "Validado" });
  });

  it("accepts notes only", () => {
    const result = validateLeadPatch({ notes: "Llamar el lunes" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ notes: "Llamar el lunes" });
  });

  it("accepts an empty object", () => {
    const result = validateLeadPatch({});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({});
  });

  it("keeps valid contact values without rewriting them", () => {
    const patch = {
      email: "ada@example.com",
      emailCommercial: null,
      phone: "",
      website: "example.com",
      linkedin: "https://linkedin.com/company/acme",
      employees: 0,
      score: 100,
      favorite: false,
      province: "Valencia" as const,
      confidence: "" as const,
      services: ["Fiscal", "Laboral"],
      responsibleId: null,
    };
    const result = validateLeadPatch(patch);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(patch);
  });

  it("rejects a non-object body", () => {
    for (const raw of [null, [], "status", 3]) {
      const result = validateLeadPatch(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(INVALID_LEAD_PATCH);
        expect(result.fieldErrors._form).toMatch(/objeto JSON/i);
      }
    }
  });

  it("rejects unknown fields", () => {
    const result = validateLeadPatch({ status: "Nuevo", archived: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(INVALID_LEAD_PATCH);
      expect(result.fieldErrors.archived).toBe("Campo no permitido");
    }
  });

  it("rejects a malformed email and a non-string email", () => {
    const malformed = validateLeadPatch({ email: "not-an-email" });
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.fieldErrors.email).toMatch(/correo/i);

    const wrongType = validateLeadPatch({ email: 12 });
    expect(wrongType.ok).toBe(false);
    if (!wrongType.ok) expect(wrongType.fieldErrors.email).toMatch(/texto/i);
  });

  it("rejects an invalid phone, status, score, and employees", () => {
    const result = validateLeadPatch({
      phone: "abc",
      status: "Inventado",
      score: 150,
      employees: -1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.phone).toMatch(/teléfono/i);
      expect(result.fieldErrors.status).toMatch(/estado/i);
      expect(result.fieldErrors.score).toMatch(/score/i);
      expect(result.fieldErrors.employees).toMatch(/empleados/i);
    }
  });

  it("rejects employees and score sent as strings", () => {
    const result = validateLeadPatch({ employees: "10", score: "80" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.employees).toBeTruthy();
      expect(result.fieldErrors.score).toBeTruthy();
    }
  });

  it("rejects an unknown province, confidence, and service", () => {
    const result = validateLeadPatch({
      province: "Madrid",
      confidence: "Altísima",
      services: ["Fiscal", "Inventado"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.province).toMatch(/provincia/i);
      expect(result.fieldErrors.confidence).toMatch(/confianza/i);
      expect(result.fieldErrors.services).toMatch(/Inventado/);
    }
  });

  it("rejects a non-boolean favorite and a bad website", () => {
    const result = validateLeadPatch({
      favorite: "true",
      website: "not a url",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.favorite).toMatch(/favorito/i);
      expect(result.fieldErrors.website).toMatch(/url/i);
    }
  });
});

describe("validateBulkLeadPatch", () => {
  it("accepts ids plus a patch", () => {
    const result = validateBulkLeadPatch({
      ids: ["a", "b"],
      patch: { favorite: true },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        ids: ["a", "b"],
        patch: { favorite: true },
      });
    }
  });

  it("keeps the required-ids message when ids or patch are missing", () => {
    for (const raw of [
      {},
      { ids: [] },
      { patch: { status: "Nuevo" } },
      { ids: ["a"] },
      { ids: ["a"], patch: null },
    ]) {
      const result = validateBulkLeadPatch(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe(BULK_PATCH_REQUIRED);
    }
  });

  it("reports invalid patch fields without the missing-ids message", () => {
    const result = validateBulkLeadPatch({
      ids: ["lead-1"],
      patch: { status: "Nope", email: 4 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(INVALID_LEAD_PATCH);
      expect(result.fieldErrors["patch.status"]).toMatch(/estado/i);
      expect(result.fieldErrors["patch.email"]).toMatch(/texto/i);
    }
  });

  it("rejects a non-array ids list and unknown top-level keys", () => {
    const ids = validateBulkLeadPatch({ ids: "lead-1", patch: {} });
    expect(ids.ok).toBe(false);
    if (!ids.ok) expect(ids.fieldErrors.ids).toMatch(/lista/i);

    const extra = validateBulkLeadPatch({
      ids: ["lead-1"],
      patch: {},
      archived: true,
    });
    expect(extra.ok).toBe(false);
    if (!extra.ok) expect(extra.fieldErrors.archived).toBe("Campo no permitido");
  });
});
