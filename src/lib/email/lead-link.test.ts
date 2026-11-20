import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fakeSupabase, filterValue, type FakeCall } from "./test-query-fake";
import { autoLinkThread, findLeadMatch } from "./lead-link";

type ThreadRow = { lead_id: string | null; lead_link_source: string | null } | null;
type LeadRow = {
  id: string;
  email?: string | null;
  email_commercial?: string | null;
  email_manager?: string | null;
};

function setup(opts: {
  thread?: ThreadRow;
  leads?: LeadRow[];
  threadError?: boolean;
  updated?: { id: string }[];
}) {
  const thread: ThreadRow =
    "thread" in opts ? (opts.thread ?? null) : { lead_id: null, lead_link_source: null };
  const fake = fakeSupabase((call: FakeCall) => {
    if (call.table === "email_threads" && call.op === "select") {
      if (opts.threadError) return { data: null, error: { message: "boom" } };
      return { data: thread };
    }
    if (call.table === "email_threads" && call.op === "update") {
      return { data: opts.updated ?? [{ id: "t1" }] };
    }
    if (call.table === "leads") return { data: opts.leads ?? [] };
    return { data: null };
  });
  return { ...fake, admin: fake.client as unknown as SupabaseClient };
}

const ana: LeadRow = { id: "lead-ana", email: "Ana@Gestoria.es" };
const luis: LeadRow = { id: "lead-luis", email: "luis@asesoria.com" };

const updates = (calls: FakeCall[]) =>
  calls.filter((c) => c.table === "email_threads" && c.op === "update");

describe("autoLinkThread", () => {
  it("vincula con origen auto cuando hay un único lead (mayúsculas en BD)", async () => {
    const { admin, calls } = setup({ leads: [ana] });
    const result = await autoLinkThread(admin, "t1", ["ANA@gestoria.es "]);
    expect(result).toEqual({ status: "linked", leadId: "lead-ana", dryRun: false });

    const [update] = updates(calls);
    expect(update.payload).toEqual({ lead_id: "lead-ana", lead_link_source: "auto" });
    expect(filterValue(update, "eq", "id")).toBe("t1");
    // Guarda de concurrencia: solo si sigue sin lead y sin decisión manual.
    expect(update.filters).toContainEqual(["is", "lead_id", null]);
    expect(update.filters).toContainEqual([
      "or",
      "lead_link_source.is.null,lead_link_source.eq.auto",
    ]);
  });

  it("solo busca entre leads activos y con patrón por cada dirección y columna", async () => {
    const { admin, calls } = setup({ leads: [ana] });
    await autoLinkThread(admin, "t1", ["ana@gestoria.es"]);
    const leadsCall = calls.find((c) => c.table === "leads")!;
    expect(leadsCall.filters).toContainEqual(["eq", "archived", false]);
    const or = filterValue(leadsCall, "or") as string;
    expect(or).toContain('email.ilike."%ana@gestoria.es%"');
    expect(or).toContain('email_commercial.ilike."%ana@gestoria.es%"');
    expect(or).toContain('email_manager.ilike."%ana@gestoria.es%"');
  });

  it("varios candidatos: no vincula y lo deja para manual", async () => {
    const { admin, calls } = setup({ leads: [ana, luis] });
    const result = await autoLinkThread(admin, "t1", [
      "ana@gestoria.es",
      "luis@asesoria.com",
    ]);
    expect(result).toEqual({ status: "skipped", reason: "ambiguous" });
    expect(updates(calls)).toHaveLength(0);
  });

  it("no sobrescribe una vinculación manual existente", async () => {
    const { admin, calls } = setup({
      thread: { lead_id: "lead-manual", lead_link_source: "manual" },
      leads: [ana],
    });
    const result = await autoLinkThread(admin, "t1", ["ana@gestoria.es"]);
    expect(result).toEqual({ status: "skipped", reason: "already-linked" });
    expect(updates(calls)).toHaveLength(0);
    expect(calls.some((c) => c.table === "leads")).toBe(false);
  });

  it("tampoco pisa una vinculación automática previa ni un hilo antiguo sin origen", async () => {
    for (const source of ["auto", null]) {
      const { admin, calls } = setup({
        thread: { lead_id: "lead-previo", lead_link_source: source },
        leads: [ana],
      });
      const result = await autoLinkThread(admin, "t1", ["ana@gestoria.es"]);
      expect(result).toEqual({ status: "skipped", reason: "already-linked" });
      expect(updates(calls)).toHaveLength(0);
    }
  });

  it("respeta un hilo desvinculado a mano (manual sin lead)", async () => {
    const { admin, calls } = setup({
      thread: { lead_id: null, lead_link_source: "manual" },
      leads: [ana],
    });
    const result = await autoLinkThread(admin, "t1", ["ana@gestoria.es"]);
    expect(result).toEqual({ status: "skipped", reason: "manual-unlinked" });
    expect(updates(calls)).toHaveLength(0);
  });

  it("si otro proceso vinculó en medio (UPDATE sin filas) no cuenta como vinculado", async () => {
    const { admin } = setup({ leads: [ana], updated: [] });
    const result = await autoLinkThread(admin, "t1", ["ana@gestoria.es"]);
    expect(result).toEqual({ status: "skipped", reason: "already-linked" });
  });

  it("sin direcciones externas no consulta nada", async () => {
    const { admin, calls } = setup({ leads: [ana] });
    const result = await autoLinkThread(admin, "t1", [
      "hola@galladev.com",
      "Ociel@GallaDev.com",
    ]);
    expect(result).toEqual({ status: "skipped", reason: "no-addresses" });
    expect(calls).toHaveLength(0);
  });

  it("sin lead coincidente no escribe", async () => {
    const { admin, calls } = setup({ leads: [] });
    const result = await autoLinkThread(admin, "t1", ["nadie@x.com"]);
    expect(result).toEqual({ status: "skipped", reason: "no-match" });
    expect(updates(calls)).toHaveLength(0);
  });

  it("descarta candidatos del preselector que no coinciden exactamente", async () => {
    const { admin } = setup({
      leads: [{ id: "lead-x", email: "xana@gestoria.es" }],
    });
    const result = await autoLinkThread(admin, "t1", ["ana@gestoria.es"]);
    expect(result).toEqual({ status: "skipped", reason: "no-match" });
  });

  it("dryRun informa sin escribir", async () => {
    const { admin, calls } = setup({ leads: [ana] });
    const result = await autoLinkThread(admin, "t1", ["ana@gestoria.es"], {
      dryRun: true,
    });
    expect(result).toEqual({ status: "linked", leadId: "lead-ana", dryRun: true });
    expect(updates(calls)).toHaveLength(0);
  });

  it("hilo inexistente", async () => {
    const { admin } = setup({ thread: null, leads: [ana] });
    expect(await autoLinkThread(admin, "t1", ["ana@gestoria.es"])).toEqual({
      status: "skipped",
      reason: "thread-not-found",
    });
  });

  it("un error de BD se traga y se registra: nunca lanza", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { admin } = setup({ threadError: true });
    await expect(
      autoLinkThread(admin, "t1", ["ana@gestoria.es"]),
    ).resolves.toEqual({ status: "skipped", reason: "error" });
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).not.toContain("ana@gestoria.es");
    warn.mockRestore();
  });
});

describe("findLeadMatch", () => {
  it("convierte comodines y comillas del patrón en % del preselector", async () => {
    const { admin, calls } = setup({ leads: [] });
    await findLeadMatch(admin, ['a_b"c@x.com']);
    const or = filterValue(calls[0], "or") as string;
    expect(or).toContain('email.ilike."%a%b%c@x.com%"');
  });

  it("sin direcciones no consulta", async () => {
    const { admin, calls } = setup({});
    expect(await findLeadMatch(admin, [])).toEqual({ status: "none" });
    expect(calls).toHaveLength(0);
  });
});
