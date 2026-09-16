import { describe, expect, it } from "vitest";
import {
  appendIngestNote,
  INGEST_SOURCE,
  mapIngestToLeadCreate,
  validateIngest,
} from "./validate-ingest";

const valid = {
  name: "Ociel Gallardo",
  email: "Tu@Empresa.com",
  company: "Mi Empresa",
  message: "Necesito automatizar las facturas, unas 5h a la semana.",
  origin: "web-galladev",
};

describe("validateIngest", () => {
  it("acepta un payload válido y normaliza", () => {
    const r = validateIngest(valid);
    expect(r.ok).toBe(true);
    expect(r.value).toMatchObject({
      name: "Ociel Gallardo",
      email: "tu@empresa.com",
      company: "Mi Empresa",
    });
  });

  it("acepta empresa vacía y origin ausente", () => {
    const r = validateIngest({ ...valid, company: "", origin: undefined });
    expect(r.ok).toBe(true);
    expect(r.value?.company).toBe("");
  });

  it("rechaza vacío, email roto, nombre corto y mensaje corto", () => {
    expect(validateIngest({ ...valid, name: "" }).errors.name).toBeTruthy();
    expect(validateIngest({ ...valid, name: "A" }).errors.name).toBeTruthy();
    expect(validateIngest({ ...valid, name: "Javi123" }).errors.name).toBeTruthy();
    expect(validateIngest({ ...valid, email: "no-email" }).errors.email).toBeTruthy();
    expect(validateIngest({ ...valid, email: "a@b" }).errors.email).toBeTruthy();
    expect(validateIngest({ ...valid, message: "hola" }).errors.message).toBeTruthy();
    expect(validateIngest({ ...valid, message: "" }).errors.message).toBeTruthy();
  });

  it("rechaza longitudes excesivas y origen desconocido", () => {
    expect(
      validateIngest({ ...valid, company: "x".repeat(101) }).errors.company,
    ).toBeTruthy();
    expect(
      validateIngest({ ...valid, message: "x".repeat(2001) }).errors.message,
    ).toBeTruthy();
    expect(validateIngest({ ...valid, origin: "otro" }).errors.origin).toBeTruthy();
  });
});

describe("mapIngestToLeadCreate", () => {
  it("mapea a lead interno con source web-galladev", () => {
    const lead = mapIngestToLeadCreate({
      name: "Ociel Gallardo",
      email: "tu@empresa.com",
      company: "Mi Empresa",
      message: "Hola",
    });
    expect(lead).toMatchObject({
      companyName: "Mi Empresa",
      email: "tu@empresa.com",
      manager: "Ociel Gallardo",
      notes: "Hola",
      source: INGEST_SOURCE,
    });
  });

  it("usa el nombre como empresa si no viene", () => {
    const lead = mapIngestToLeadCreate({
      name: "Ociel Gallardo",
      email: "tu@empresa.com",
      company: "",
      message: "Hola",
    });
    expect(lead.companyName).toBe("Ociel Gallardo");
  });
});

describe("appendIngestNote", () => {
  it("anexa con sello fechado", () => {
    const at = new Date("2026-09-16T10:00:00Z");
    expect(appendIngestNote("Nota previa", "Nuevo mensaje", at)).toBe(
      "Nota previa\n\n[web-galladev · 2026-09-16]\nNuevo mensaje",
    );
    expect(appendIngestNote(null, "Nuevo mensaje", at)).toBe(
      "[web-galladev · 2026-09-16]\nNuevo mensaje",
    );
  });
});
