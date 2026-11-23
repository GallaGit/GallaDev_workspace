import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fakeSupabase, filterValue } from "./test-query-fake";
import { backfillLeadLinks } from "./lead-link-backfill";

type Thread = {
  id: string;
  lead_id: string | null;
  lead_link_source: "manual" | "auto" | null;
  created_at: string;
};

function setup() {
  const threads: Thread[] = [
    { id: "t-ana", lead_id: null, lead_link_source: null, created_at: "2026-10-01" },
    { id: "t-multi", lead_id: null, lead_link_source: null, created_at: "2026-10-02" },
    { id: "t-none", lead_id: null, lead_link_source: null, created_at: "2026-10-03" },
    { id: "t-manual", lead_id: "lead-x", lead_link_source: "manual", created_at: "2026-10-04" },
    { id: "t-unlinked", lead_id: null, lead_link_source: "manual", created_at: "2026-10-05" },
  ];
  const messages: Record<string, { from_address: string; to_addresses: string[]; cc_addresses: string[] }[]> = {
    "t-ana": [
      { from_address: "ANA@gestoria.es", to_addresses: ["hola@galladev.com"], cc_addresses: [] },
      { from_address: "hola@galladev.com", to_addresses: ["ana@gestoria.es"], cc_addresses: [] },
    ],
    "t-multi": [
      { from_address: "ana@gestoria.es", to_addresses: ["luis@asesoria.com"], cc_addresses: [] },
    ],
    "t-none": [
      { from_address: "nadie@x.com", to_addresses: ["hola@galladev.com"], cc_addresses: [] },
    ],
    "t-manual": [{ from_address: "ana@gestoria.es", to_addresses: [], cc_addresses: [] }],
    "t-unlinked": [{ from_address: "ana@gestoria.es", to_addresses: [], cc_addresses: [] }],
  };
  const leads = [
    { id: "lead-ana", email: "Ana@Gestoria.es" },
    { id: "lead-luis", email: "luis@asesoria.com" },
  ];

  const fake = fakeSupabase((call) => {
    const eqv = (col: string) => filterValue(call, "eq", col);
    if (call.table === "email_threads") {
      if (call.op === "update") {
        const row = threads.find((t) => t.id === eqv("id"));
        if (!row || row.lead_id !== null || row.lead_link_source === "manual") {
          return { data: [] };
        }
        Object.assign(row, call.payload);
        return { data: [{ id: row.id }] };
      }
      if (eqv("id")) return { data: threads.find((t) => t.id === eqv("id")) ?? null };
      const range = call.filters.find((f) => f[0] === "range");
      const rows = threads
        .filter((t) => t.lead_id === null && t.lead_link_source === null)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      const [from, to] = range ? [range[1] as number, range[2] as number] : [0, rows.length];
      return { data: rows.slice(from, to + 1).map((t) => ({ id: t.id })) };
    }
    if (call.table === "email_messages") {
      return { data: messages[eqv("thread_id") as string] ?? [] };
    }
    if (call.table === "leads") return { data: leads };
    return { data: null };
  });
  return { threads, admin: fake.client as unknown as SupabaseClient, calls: fake.calls };
}

describe("backfillLeadLinks", () => {
  it("vincula solo los hilos con un único lead y deja ambiguos/sin match", async () => {
    const { admin, threads } = setup();
    const result = await backfillLeadLinks(admin);
    expect(result).toMatchObject({
      dryRun: false,
      threadsScanned: 3,
      ambiguous: 1,
      noMatch: 1,
      nextOffset: null,
    });
    expect(result.linked).toEqual([{ threadId: "t-ana", leadId: "lead-ana" }]);
    expect(threads.find((t) => t.id === "t-ana")).toMatchObject({
      lead_id: "lead-ana",
      lead_link_source: "auto",
    });
    expect(threads.find((t) => t.id === "t-multi")?.lead_id).toBeNull();
  });

  it("no toca vinculaciones manuales ni hilos desvinculados a mano", async () => {
    const { admin, threads } = setup();
    await backfillLeadLinks(admin);
    expect(threads.find((t) => t.id === "t-manual")).toMatchObject({
      lead_id: "lead-x",
      lead_link_source: "manual",
    });
    expect(threads.find((t) => t.id === "t-unlinked")).toMatchObject({
      lead_id: null,
      lead_link_source: "manual",
    });
  });

  it("es idempotente: repetirlo no cambia nada", async () => {
    const { admin, threads } = setup();
    await backfillLeadLinks(admin);
    const snapshot = JSON.stringify(threads);
    const second = await backfillLeadLinks(admin);
    expect(second.linked).toEqual([]);
    expect(second.threadsScanned).toBe(2);
    expect(JSON.stringify(threads)).toBe(snapshot);
  });

  it("dryRun informa lo que vincularía sin escribir", async () => {
    const { admin, threads, calls } = setup();
    const result = await backfillLeadLinks(admin, { dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.linked).toEqual([{ threadId: "t-ana", leadId: "lead-ana" }]);
    expect(threads.every((t) => t.lead_link_source !== "auto")).toBe(true);
    expect(calls.some((c) => c.op === "update")).toBe(false);
  });

  it("pagina con limit y offset y devuelve nextOffset", async () => {
    const { admin } = setup();
    const first = await backfillLeadLinks(admin, { limit: 2 });
    expect(first.threadsScanned).toBe(2);
    // t-ana quedó vinculado (sale del recorrido); t-multi sigue sin lead.
    expect(first.nextOffset).toBe(1);
    const second = await backfillLeadLinks(admin, { limit: 2, offset: first.nextOffset! });
    expect(second.threadsScanned).toBe(1);
    expect(second.noMatch).toBe(1);
    expect(second.nextOffset).toBeNull();
  });

  it("acota limit y offset", async () => {
    const { admin, calls } = setup();
    await backfillLeadLinks(admin, { limit: 99999, offset: -5 });
    const range = calls[0].filters.find((f) => f[0] === "range");
    expect(range).toEqual(["range", 0, 499]);
  });
});
