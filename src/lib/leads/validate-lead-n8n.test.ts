import { describe, expect, it } from "vitest";
import { validateLeadCreate } from "@/lib/leads/validate-lead";
import { leadCreateToRow } from "@/lib/supabase/mappers";

describe("validateLeadCreate — campos ricos n8n", () => {
  const base = {
    companyName: "Gestoría Prospect SL",
    website: "https://prospecto.es",
    phone: "+34600111222",
  };

  it("acepta emailSubject/emailBody/score/status/notesOverflow/discoveredAt/source", () => {
    const r = validateLeadCreate({
      ...base,
      source: "n8n",
      status: "Email preparado",
      emailSubject: "Propuesta automatización",
      emailBody: "Hola,\n\nOs escribo porque...",
      score: 78,
      notes: "Prospecto cualificado",
      notesOverflow: "Detalle largo del scraping",
      discoveredAt: "2026-09-10T08:00:00.000Z",
    });
    expect(r.ok).toBe(true);
    expect(r.value).toMatchObject({
      companyName: "Gestoría Prospect SL",
      source: "n8n",
      status: "Email preparado",
      emailSubject: "Propuesta automatización",
      emailBody: "Hola,\n\nOs escribo porque...",
      score: 78,
      notes: "Prospecto cualificado",
      notesOverflow: "Detalle largo del scraping",
      discoveredAt: "2026-09-10T08:00:00.000Z",
    });
  });

  it("rechaza status y score inválidos", () => {
    expect(
      validateLeadCreate({ ...base, status: "Inventado" }).errors.status,
    ).toBeTruthy();
    expect(validateLeadCreate({ ...base, score: 150 }).errors.score).toBeTruthy();
    expect(
      validateLeadCreate({ ...base, discoveredAt: "no-fecha" }).errors
        .discoveredAt,
    ).toBeTruthy();
  });

  it("sigue exigiendo companyName y un canal de contacto", () => {
    expect(validateLeadCreate({ companyName: "A" }).ok).toBe(false);
    expect(
      validateLeadCreate({
        companyName: "Ok SL",
        email: "",
        phone: "",
        website: "",
      }).errors._form,
    ).toBeTruthy();
  });
});

describe("leadCreateToRow — defaults ricos n8n", () => {
  it("persiste campos ricos cuando vienen en LeadCreateInput", () => {
    const row = leadCreateToRow({
      companyName: "Nueva SL",
      source: "n8n",
      status: "Email preparado",
      emailSubject: "Asunto",
      emailBody: "Cuerpo",
      score: 90,
      notesOverflow: "overflow",
      discoveredAt: "2026-09-01T12:00:00.000Z",
    });
    expect(row.source).toBe("n8n");
    expect(row.status).toBe("Email preparado");
    expect(row.email_subject).toBe("Asunto");
    expect(row.email_body).toBe("Cuerpo");
    expect(row.score).toBe(90);
    expect(row.notes_overflow).toBe("overflow");
    expect(row.discovered_at).toBe("2026-09-01T12:00:00.000Z");
  });

  it("mantiene defaults Manual/Nuevo si no hay campos ricos", () => {
    const row = leadCreateToRow({ companyName: "Solo nombre" });
    expect(row.source).toBe("Manual");
    expect(row.status).toBe("Nuevo");
    expect(row.email_subject).toBeNull();
    expect(row.score).toBeNull();
  });
});
