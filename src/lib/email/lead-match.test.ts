import { describe, expect, it } from "vitest";
import {
  externalAddresses,
  leadEmailSet,
  normalizeEmail,
  resolveLeadMatch,
  type LeadEmailRow,
} from "./lead-match";

describe("normalizeEmail", () => {
  it("pasa a minúsculas y quita espacios", () => {
    expect(normalizeEmail("  Ana.Lopez@Gestoria.ES ")).toBe("ana.lopez@gestoria.es");
    expect(normalizeEmail("ana @ gestoria.es")).toBe("ana@gestoria.es");
  });

  it("extrae la dirección de «Nombre <dirección>»", () => {
    expect(normalizeEmail('"Ana López" <ANA@Gestoria.es>')).toBe("ana@gestoria.es");
  });

  it("devuelve vacío sin valor", () => {
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
    expect(normalizeEmail("   ")).toBe("");
  });
});

describe("externalAddresses", () => {
  it("une listas, normaliza y quita duplicados", () => {
    expect(
      externalAddresses(
        ["Ana@X.com", "ana@x.com"],
        ['Luis <LUIS@y.com>', null, undefined],
        undefined,
      ),
    ).toEqual(["ana@x.com", "luis@y.com"]);
  });

  it("excluye nuestros buzones y direcciones que no son email", () => {
    expect(
      externalAddresses([
        "HOLA@galladev.com",
        "ociel@galladev.com",
        "no-es-un-email",
        "",
        "cliente@x.com",
      ]),
    ).toEqual(["cliente@x.com"]);
  });
});

describe("leadEmailSet", () => {
  it("recoge email, comercial y responsable normalizados", () => {
    const set = leadEmailSet({
      id: "1",
      email: " Info@Acme.com ",
      email_commercial: "VENTAS@acme.com",
      email_manager: null,
    });
    expect(Array.from(set).sort()).toEqual(["info@acme.com", "ventas@acme.com"]);
  });
});

describe("resolveLeadMatch", () => {
  const leads: LeadEmailRow[] = [
    { id: "lead-a", email: "Ana@Gestoria.es" },
    { id: "lead-b", email: "luis@asesoria.com", email_commercial: "ventas@asesoria.com" },
    { id: "lead-c", email: "  PACO@otra.com  " },
  ];

  it("un único lead coincidente se devuelve como matched", () => {
    expect(resolveLeadMatch(["ana@gestoria.es"], leads)).toEqual({
      status: "matched",
      leadId: "lead-a",
    });
  });

  it("ignora mayúsculas y espacios en ambos lados", () => {
    expect(resolveLeadMatch(["paco@otra.com"], leads)).toEqual({
      status: "matched",
      leadId: "lead-c",
    });
    expect(resolveLeadMatch(["  ANA@GESTORIA.ES "], leads)).toEqual({
      status: "matched",
      leadId: "lead-a",
    });
  });

  it("también casa con el email comercial o del responsable", () => {
    expect(resolveLeadMatch(["ventas@asesoria.com"], leads)).toEqual({
      status: "matched",
      leadId: "lead-b",
    });
  });

  it("varios leads distintos → ambiguous (no se vincula)", () => {
    const result = resolveLeadMatch(["ana@gestoria.es", "luis@asesoria.com"], leads);
    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.leadIds.sort()).toEqual(["lead-a", "lead-b"]);
    }
  });

  it("dos fichas con el mismo email (duplicado) → ambiguous", () => {
    const dup: LeadEmailRow[] = [
      { id: "d1", email: "dup@x.com" },
      { id: "d2", email: "DUP@x.com" },
    ];
    expect(resolveLeadMatch(["dup@x.com"], dup).status).toBe("ambiguous");
  });

  it("un mismo lead coincidente por varios emails cuenta una vez", () => {
    expect(
      resolveLeadMatch(["luis@asesoria.com", "ventas@asesoria.com"], leads),
    ).toEqual({ status: "matched", leadId: "lead-b" });
  });

  it("sin coincidencias o sin direcciones → none", () => {
    expect(resolveLeadMatch(["nadie@x.com"], leads)).toEqual({ status: "none" });
    expect(resolveLeadMatch([], leads)).toEqual({ status: "none" });
    expect(resolveLeadMatch(["ana@gestoria.es"], [])).toEqual({ status: "none" });
  });

  it("no hace coincidencias parciales de dominio o usuario", () => {
    expect(resolveLeadMatch(["ana@gestoria.es.evil.com"], leads)).toEqual({
      status: "none",
    });
    expect(resolveLeadMatch(["xana@gestoria.es"], leads)).toEqual({ status: "none" });
  });
});
