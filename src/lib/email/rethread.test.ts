import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resend } from "resend";
import { fakeSupabase, filterValue } from "./test-query-fake";
import { rethreadSplitThreads } from "./rethread";

const SES_ID = "<0102-real@eu-west-1.amazonses.com>";

function setup() {
  // t-a: Ociel respondió (guardado con nuestro id). t-b: respuesta del cliente partida.
  const messages = [
    { id: "m1", thread_id: "t-a", direction: "inbound", from_address: "c@x.com", to_addresses: ["ociel@galladev.com"], cc_addresses: [], subject: "adjunto", in_reply_to: null, references: null, received_at: "2026-10-09T12:26:00Z", message_id: "<c1@gmail>", resend_email_id: "r1" },
    { id: "m2", thread_id: "t-a", direction: "outbound", from_address: "ociel@galladev.com", to_addresses: ["c@x.com"], cc_addresses: [], subject: "Re: adjunto", in_reply_to: "<c1@gmail>", references: "<c1@gmail>", received_at: "2026-10-09T12:31:00Z", message_id: "<uuid@galladev.com>", resend_email_id: "r2" },
    { id: "m3", thread_id: "t-b", direction: "inbound", from_address: "c@x.com", to_addresses: ["ociel@galladev.com"], cc_addresses: [], subject: "Re: adjunto", in_reply_to: SES_ID, references: `<c1@gmail> ${SES_ID}`, received_at: "2026-10-09T12:33:00Z", message_id: "<c2@gmail>", resend_email_id: "r3" },
  ];
  const threads = [
    { id: "t-a", mailbox_address: "ociel@galladev.com", lead_id: null, is_read: true, created_at: "2026-10-09T12:26:00Z" },
    { id: "t-b", mailbox_address: "ociel@galladev.com", lead_id: "lead-1", is_read: false, created_at: "2026-10-09T12:33:00Z" },
  ];
  const fake = fakeSupabase((call) => {
    const eqv = (col: string) => filterValue(call, "eq", col);
    if (call.table === "email_messages") {
      if (call.op === "update") {
        const p = call.payload as Record<string, string>;
        for (const m of messages) {
          if ((eqv("id") && m.id === eqv("id")) || (eqv("thread_id") && m.thread_id === eqv("thread_id"))) Object.assign(m, p);
        }
        return { data: null };
      }
      let rows = messages.slice();
      if (eqv("direction")) rows = rows.filter((m) => m.direction === eqv("direction"));
      const like = filterValue(call, "like", "message_id") as string | undefined;
      if (like) rows = rows.filter((m) => m.message_id.endsWith(like.slice(1)));
      if (eqv("thread_id")) rows = rows.filter((m) => m.thread_id === eqv("thread_id"));
      const ids = filterValue(call, "in", "message_id") as string[] | undefined;
      if (ids) rows = rows.filter((m) => ids.includes(m.message_id));
      const order = call.filters.find((f) => f[0] === "order");
      if (order) rows.sort((a, b) => (order[2] as { ascending: boolean }).ascending ? a.received_at.localeCompare(b.received_at) : b.received_at.localeCompare(a.received_at));
      if (call.head) return { count: rows.length };
      return { data: rows };
    }
    if (call.table === "email_threads") {
      if (call.op === "delete") {
        const i = threads.findIndex((t) => t.id === eqv("id"));
        if (i >= 0) threads.splice(i, 1);
        return { data: null };
      }
      if (call.op === "update") {
        Object.assign(threads.find((t) => t.id === eqv("id")) ?? {}, call.payload);
        return { data: null };
      }
      if (eqv("id")) return { data: threads.find((t) => t.id === eqv("id")) ?? null };
      const ids = filterValue(call, "in", "id") as string[] | undefined;
      if (ids) return { data: threads.filter((t) => ids.includes(t.id)) };
      return { data: threads.slice() };
    }
    return { data: null };
  });
  const get = vi.fn().mockResolvedValue({ data: { message_id: SES_ID } });
  const client = { emails: { get } } as unknown as Resend;
  return { fake, messages, threads, client };
}

describe("rethreadSplitThreads", () => {
  it("fixes outbound Message-ID and merges the split reply thread", async () => {
    const { fake, messages, threads, client } = setup();
    const r = await rethreadSplitThreads(fake.client as unknown as SupabaseClient, client);
    expect(r.outboundIdsFixed).toBe(1);
    expect(r.merged).toEqual([{ from: "t-b", into: "t-a", via: "in-reply-to", messages: 1 }]);
    expect(messages.every((m) => m.thread_id === "t-a")).toBe(true);
    expect(threads.map((t) => t.id)).toEqual(["t-a"]);
    expect(threads[0]).toMatchObject({ lead_id: "lead-1", is_read: false, message_count: 3 });

    // Idempotente: segunda pasada no cambia nada.
    const again = await rethreadSplitThreads(fake.client as unknown as SupabaseClient, client);
    expect(again.outboundIdsFixed).toBe(0);
    expect(again.merged).toEqual([]);
  });

  it("dryRun reports without writing", async () => {
    const { fake, messages, threads, client } = setup();
    const r = await rethreadSplitThreads(fake.client as unknown as SupabaseClient, client, { dryRun: true });
    expect(r.dryRun).toBe(true);
    expect(r.merged.length).toBe(1);
    expect(messages.find((m) => m.id === "m3")?.thread_id).toBe("t-b");
    expect(threads.length).toBe(2);
    expect(fake.calls.some((c) => c.op !== "select")).toBe(false);
  });
});
