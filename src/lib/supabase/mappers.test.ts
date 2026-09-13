import { describe, expect, it } from "vitest";
import {
  leadCreateToRow,
  leadPatchToRow,
  mapRowToLead,
  type LeadRow,
} from "./mappers";
import { LEAD_STATUSES } from "@/lib/domain/lead";

function baseRow(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: "ed07cdd4-c542-4f9a-8b8e-bd73e358c6cd",
    notion_page_id: "ed07cdd4c5424f9a8b8ebd73e358c6cd",
    company_name: "Gestoría Ejemplo SL",
    website: "https://ejemplo.es",
    email: "info@ejemplo.es",
    email_commercial: null,
    email_manager: null,
    phone: "+34600000000",
    address: "Calle Mayor 12",
    postal_code: "46001",
    city: "València",
    city_canonical: "Valencia",
    province: "Valencia",
    employees: 7,
    linkedin: null,
    services: ["Fiscal", "Laboral"],
    status: "Nuevo",
    last_activity: "2026-09-12",
    discovered_at: "2026-09-10T08:00:00.000Z",
    notes: "Interesados en automatización",
    notes_overflow: null,
    email_subject: "Hola [Nombre]",
    email_body: "Línea 1\nLínea 2",
    score: 82,
    manager: "Ana",
    role: "Gerente",
    confidence: "Alta",
    software: "A3",
    source: "n8n",
    last_contact: null,
    next_follow_up: "2026-09-20",
    favorite: true,
    ai_analysis: "Dolor: facturación manual",
    url: "https://notion.so/abc",
    notion_last_edited_time: "2026-09-12T10:00:00.000Z",
    archived: false,
    tags: [],
    responsable: null,
    created_at: "2026-09-10T08:00:00.000Z",
    updated_at: "2026-09-12T10:00:00.000Z",
    ...overrides,
  };
}

describe("supabase mappers", () => {
  it("mapea fila → Lead con todos los campos", () => {
    const lead = mapRowToLead(baseRow());
    expect(lead.id).toBe("ed07cdd4-c542-4f9a-8b8e-bd73e358c6cd");
    expect(lead.companyName).toBe("Gestoría Ejemplo SL");
    expect(lead.status).toBe("Nuevo");
    expect(lead.cityCanonical).toBe("Valencia");
    expect(lead.services).toEqual(["Fiscal", "Laboral"]);
    expect(lead.favorite).toBe(true);
    expect(lead.archived).toBe(false);
    expect(lead.notesOverflow).toBeNull();
  });

  it("normaliza estados legacy al leer", () => {
    expect(mapRowToLead(baseRow({ status: "Pendiente" })).status).toBe(
      "Pendiente revisar",
    );
    expect(mapRowToLead(baseRow({ status: "Contactado" })).status).toBe(
      "Email enviado",
    );
    expect(mapRowToLead(baseRow({ status: "Contratado" })).status).toBe(
      "Cliente",
    );
    expect(mapRowToLead(baseRow({ status: "???" })).status).toBe(
      "Pendiente revisar",
    );
  });

  it("acepta los 9 estados canónicos sin alterarlos", () => {
    for (const status of LEAD_STATUSES) {
      expect(mapRowToLead(baseRow({ status })).status).toBe(status);
    }
  });

  it("recalcula cityCanonical si la fila no la trae", () => {
    const lead = mapRowToLead(
      baseRow({ city: "València", city_canonical: null }),
    );
    expect(lead.cityCanonical).toBe("Valencia");
  });

  it("create genera fila con defaults de app (Nuevo/Manual)", () => {
    const row = leadCreateToRow({ companyName: "Nueva SL" });
    expect(row.company_name).toBe("Nueva SL");
    expect(row.status).toBe("Nuevo");
    expect(row.source).toBe("Manual");
    expect(row.favorite).toBe(false);
    expect(row.archived).toBe(false);
    expect(row.notion_page_id).toBeNull();
  });

  it("patch solo incluye campos definidos + refresca last_activity", () => {
    const row = leadPatchToRow({ status: "Validado" });
    expect(row.status).toBe("Validado");
    expect(row.last_activity).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(row.company_name).toBeUndefined();
    expect(row.email).toBeUndefined();
  });

  it("patch de ciudad recalcula canónica", () => {
    const row = leadPatchToRow({ city: "Sagunt" });
    expect(row.city).toBe("Sagunt");
    expect(row.city_canonical).toBe("Sagunto");
  });
});
