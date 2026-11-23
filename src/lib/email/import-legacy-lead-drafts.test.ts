import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fakeSupabase, filterValue } from "./test-query-fake";
import { importLegacyLeadDrafts } from "./import-legacy-lead-drafts";

const L1 = "11111111-1111-4111-8111-111111111111";
const L2 = "22222222-2222-4222-8222-222222222222";
const L3 = "33333333-3333-4333-8333-333333333333";
const DRAFT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type Lead = {
  id: string;
  email: string | null;
  email_commercial: string | null;
  email_manager: string | null;
  email_subject: string | null;
  email_body: string | null;
};

function setup(leads: Lead[], existingLeadIds: string[] = []) {
  const inserted: unknown[] = [];
  const fake = fakeSupabase((call) => {
    if (call.table === "leads" && call.op === "select") {
      const range = call.filters.find((f) => f[0] === "range");
      const [from, to] = range
        ? [range[1] as number, range[2] as number]
        : [0, leads.length];
      return { data: leads.slice(from, to + 1) };
    }
    if (call.table === "email_drafts" && call.op === "select") {
      const ids = (filterValue(call, "in", "lead_id") as string[] | undefined) ?? [];
      return {
        data: existingLeadIds
          .filter((id) => ids.includes(id))
          .map((lead_id) => ({ lead_id })),
      };
    }
    if (call.table === "email_drafts" && call.op === "insert") {
      inserted.push(call.payload);
      return { data: { id: DRAFT } };
    }
    return { data: null };
  });
  return {
    admin: fake.client as unknown as SupabaseClient,
    inserted,
    calls: fake.calls,
  };
}

const lead = (
  id: string,
  patch: Partial<Lead> = {},
): Lead => ({
  id,
  email: "ana@gestoria.es",
  email_commercial: null,
  email_manager: null,
  email_subject: "Hola",
  email_body: "Cuerpo",
  ...patch,
});

describe("importLegacyLeadDrafts", () => {
  it("por defecto es dryRun y no escribe; incluye al lead sin borrador de correo", async () => {
    const { admin, inserted } = setup([lead(L1), lead(L2, { email_subject: null, email_body: null })]);
    const result = await importLegacyLeadDrafts(admin);
    expect(result).toMatchObject({
      dryRun: true,
      scanned: 2,
      skipped: 1,
      nextOffset: null,
    });
    expect(result.created).toEqual([{ leadId: L1, draftId: null }]);
    expect(inserted).toHaveLength(0);
  });

  it("salta leads que ya tienen un borrador de mensaje nuevo y los de texto vacío", async () => {
    const { admin, inserted } = setup(
      [
        lead(L1),
        lead(L2, { email_subject: "  ", email_body: "" }),
        lead(L3),
      ],
      [L3],
    );
    const result = await importLegacyLeadDrafts(admin, { dryRun: true });
    expect(result.created).toEqual([{ leadId: L1, draftId: null }]);
    expect(result.skipped).toBe(2);
    expect(inserted).toHaveLength(0);
  });

  it("con dryRun false crea el borrador (hola@, destinatario del lead) y no toca el lead", async () => {
    const { admin, inserted, calls } = setup([
      lead(L1, {
        email: "general@x.com",
        email_manager: "gerente@x.com",
        email_subject: "Asunto",
        email_body: "Cuerpo",
      }),
    ]);
    const result = await importLegacyLeadDrafts(admin, { dryRun: false });
    expect(result.dryRun).toBe(false);
    expect(result.created).toEqual([{ leadId: L1, draftId: DRAFT }]);
    expect(inserted).toEqual([
      {
        mailbox_address: "hola@galladev.com",
        to_address: "gerente@x.com",
        subject: "Asunto",
        body_text: "Cuerpo",
        lead_id: L1,
      },
    ]);
    expect(calls.some((c) => c.table === "leads" && c.op !== "select")).toBe(false);
  });

  it("pagina con nextOffset cuando la página está llena", async () => {
    const { admin } = setup([lead(L1), lead(L2)]);
    const result = await importLegacyLeadDrafts(admin, { dryRun: true, limit: 1, offset: 0 });
    expect(result.scanned).toBe(1);
    expect(result.nextOffset).toBe(1);
  });
});
