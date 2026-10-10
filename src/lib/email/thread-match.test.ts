import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resend } from "resend";
import { fakeSupabase, filterValue } from "./test-query-fake";
import { fetchSentMessageId, findThreadForMessage } from "./thread-match";

// Datos reales (forma) de producción: la respuesta de Gmail apunta al
// Message-ID que puso SES, no al <uuid@galladev.com> que mandamos.
const SES_ID = "<010201a120a5c386-a5cd4e25@eu-west-1.amazonses.com>";

const stored = [
  {
    thread_id: "t-orig",
    message_id: SES_ID,
    subject: "Re: adjunto prueba",
    from_address: "ociel@galladev.com",
    to_addresses: ["ociel.galla@gmail.com"],
    cc_addresses: [],
    received_at: "2026-10-09T12:31:36Z",
  },
];

function admin(threadMailbox = "ociel@galladev.com") {
  return fakeSupabase((call) => {
    if (call.table === "email_messages") {
      const ids = filterValue(call, "in", "message_id") as string[] | undefined;
      if (ids) return { data: stored.filter((m) => ids.includes(m.message_id)) };
      if (filterValue(call, "or")) return { data: stored };
    }
    if (call.table === "email_threads") {
      return { data: [{ id: "t-orig", mailbox_address: threadMailbox }] };
    }
    return { data: [] };
  });
}

const base = {
  subject: "Re: adjunto prueba",
  counterpart: "ociel.galla@gmail.com",
  mailbox: "ociel@galladev.com",
  at: "2026-10-09T12:33:28Z",
};

describe("findThreadForMessage", () => {
  it("matches In-Reply-To even with different casing/brackets", async () => {
    const { client } = admin();
    const r = await findThreadForMessage(client as unknown as SupabaseClient, {
      ...base,
      inReplyTo: SES_ID.slice(1, -1),
      references: null,
    });
    expect(r).toEqual({ threadId: "t-orig", via: "in-reply-to" });
  });

  it("matches any id in folded References", async () => {
    const { client } = admin();
    const r = await findThreadForMessage(client as unknown as SupabaseClient, {
      ...base,
      inReplyTo: "<unknown@x>",
      references: `<root@mail.gmail.com>\r\n ${SES_ID}`,
    });
    expect(r).toEqual({ threadId: "t-orig", via: "references" });
  });

  it("falls back to normalized subject + counterpart in the same mailbox", async () => {
    const { client } = admin();
    const r = await findThreadForMessage(client as unknown as SupabaseClient, {
      ...base,
      subject: "RE: Adjunto prueba",
      inReplyTo: "<our-old-uuid@galladev.com>",
      references: null,
    });
    expect(r).toEqual({ threadId: "t-orig", via: "subject" });
  });

  it("does not use subject fallback across mailboxes", async () => {
    const { client } = admin("hola@galladev.com");
    const r = await findThreadForMessage(client as unknown as SupabaseClient, {
      ...base,
      inReplyTo: "<nope@x>",
      references: null,
    });
    expect(r).toBeNull();
  });

  it("does not merge a brand-new message (no Re:, no headers) by subject", async () => {
    const { client, calls } = admin();
    const r = await findThreadForMessage(client as unknown as SupabaseClient, {
      ...base,
      subject: "adjunto prueba",
      inReplyTo: null,
      references: null,
    });
    expect(r).toBeNull();
    expect(calls.length).toBe(0);
  });
});

describe("fetchSentMessageId", () => {
  it("returns the real Message-ID from Resend", async () => {
    const get = vi.fn().mockResolvedValue({ data: { message_id: SES_ID } });
    const id = await fetchSentMessageId({ emails: { get } } as unknown as Resend, "re_1");
    expect(id).toBe(SES_ID);
  });
  it("retries and returns null when missing", async () => {
    const get = vi.fn().mockResolvedValue({ data: null, error: {} });
    const id = await fetchSentMessageId({ emails: { get } } as unknown as Resend, "re_1", {
      attempts: 2,
      delayMs: 0,
    });
    expect(id).toBeNull();
    expect(get).toHaveBeenCalledTimes(2);
  });
});
