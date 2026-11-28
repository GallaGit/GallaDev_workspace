import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/i18n-wrapper";
import { LeadHistorySection } from "./lead-history-section";
import type { AuditEntry, AuditListResponse } from "@/lib/audit/types";

const LEAD_ID = "11111111-1111-4111-8111-111111111111";

function entry(partial: Partial<AuditEntry>): AuditEntry {
  return {
    id: crypto.randomUUID(),
    created_at: "2026-11-20T10:00:00.000Z",
    actor_id: "u-ana",
    actor_email: "ana@example.com",
    actor_role: "Seller",
    action: "lead.updated",
    entity: "lead",
    entity_id: LEAD_ID,
    lead_id: LEAD_ID,
    diff: { fields: [] },
    ...partial,
  };
}

function respond(body: Partial<AuditListResponse>) {
  const full: AuditListResponse = {
    entries: [],
    total: 0,
    page: 1,
    pageSize: 50,
    viewerId: "u-ana",
    labels: {},
    ...body,
  };
  return vi.fn(async () =>
    new Response(JSON.stringify(full), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

beforeEach(() => cleanup());
afterEach(() => vi.unstubAllGlobals());

describe("LeadHistorySection", () => {
  it("muestra quién, qué y antes→después del estado", async () => {
    vi.stubGlobal(
      "fetch",
      respond({
        entries: [
          entry({
            action: "lead.status_changed",
            actor_id: "u-bob",
            actor_email: "bob@example.com",
            actor_role: "Admin",
            diff: {
              fields: ["status"],
              changes: { status: { from: "Nuevo", to: "Validado" } },
            },
          }),
        ],
        total: 1,
      }),
    );
    renderWithIntl(<LeadHistorySection leadId={LEAD_ID} />);
    await waitFor(() => expect(screen.getByText("bob@example.com")).toBeTruthy());
    expect(screen.getByText(/cambió el estado/)).toBeTruthy();
    expect(screen.getByText(/Estado: Nuevo → Validado/)).toBeTruthy();
  });

  it("edición de nota: solo el nombre del campo", async () => {
    vi.stubGlobal(
      "fetch",
      respond({
        entries: [entry({ action: "lead.note_edited", diff: { fields: ["notes"] } })],
        total: 1,
      }),
    );
    renderWithIntl(<LeadHistorySection leadId={LEAD_ID} />);
    await waitFor(() => expect(screen.getByText(/editó la nota/)).toBeTruthy());
    expect(screen.getByText("Notas")).toBeTruthy();
    expect(screen.queryByText(/→/)).toBeNull();
  });

  it("reasignación: usa «Tú» y las etiquetas resueltas", async () => {
    vi.stubGlobal(
      "fetch",
      respond({
        entries: [
          entry({
            action: "lead.reassigned",
            actor_id: "u-admin",
            actor_email: "admin@example.com",
            actor_role: "Admin",
            diff: {
              fields: ["responsibleId"],
              changes: { responsibleId: { from: null, to: "u-ana" } },
            },
          }),
        ],
        total: 1,
      }),
    );
    renderWithIntl(<LeadHistorySection leadId={LEAD_ID} />);
    await waitFor(() => expect(screen.getByText(/reasignó el lead/)).toBeTruthy());
    expect(screen.getByText(/Responsable: — → Tú/)).toBeTruthy();
  });

  it("estado vacío", async () => {
    vi.stubGlobal("fetch", respond({}));
    renderWithIntl(<LeadHistorySection leadId={LEAD_ID} />);
    await waitFor(() =>
      expect(screen.getByText("Todavía no hay eventos registrados.")).toBeTruthy(),
    );
  });
});
