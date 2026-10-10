import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resend } from "resend";
import { fakeSupabase, filterValue } from "./test-query-fake";

const resolveAttachmentDownload = vi.hoisted(() => vi.fn());
vi.mock("./attachment-download", () => ({ resolveAttachmentDownload }));
vi.mock("./resend-client", () => ({ getResendClient: () => null }));

import { buildForwardBodies, sendForward } from "./send-forward";

const original = {
  id: "m1",
  from_address: "ana@example.com",
  from_name: "Ana",
  to_addresses: ["hola@galladev.com"],
  subject: "Presupuesto",
  received_at: "2026-10-09T12:00:00Z",
  body_text: "Hola, adjunto PDF",
  body_html: "<p>Hola, adjunto PDF</p>",
};

function admin() {
  return fakeSupabase((call) => {
    if (call.table === "email_threads" && call.op === "select") {
      return { data: { id: "t1", subject: "Presupuesto", mailbox_address: "hola@galladev.com" } };
    }
    if (call.table === "email_messages" && call.op === "insert") return { data: { id: "out-1" } };
    if (call.table === "email_messages" && call.head) return { count: 2 };
    if (call.table === "email_messages") return { data: [original] };
    if (call.table === "email_attachments") {
      expect(filterValue(call, "eq", "message_id")).toBe("m1");
      return { data: [{ id: "a1", filename: "doc.pdf" }, { id: "a2", filename: "old.png" }] };
    }
    return { data: null };
  });
}

describe("buildForwardBodies", () => {
  it("quotes the original and escapes user text", () => {
    const b = buildForwardBodies("<b>FYI</b>", original, ["old.png"]);
    expect(b.text).toContain("FYI");
    expect(b.text).toContain("De / From: Ana <ana@example.com>");
    expect(b.text).toContain("Hola, adjunto PDF");
    expect(b.text).toContain("old.png");
    expect(b.html).toContain("&lt;b&gt;FYI&lt;/b&gt;");
    expect(b.html).toContain("<blockquote");
  });
});

describe("sendForward", () => {
  const send = vi.fn();
  const get = vi.fn();
  beforeEach(() => {
    send.mockReset().mockResolvedValue({ data: { id: "re_fwd" }, error: null });
    get.mockReset().mockResolvedValue({ data: { message_id: "<ses@amazonses.com>" } });
    resolveAttachmentDownload.mockReset().mockImplementation(async (_s, id: string) =>
      id === "a1"
        ? { ok: true, downloadUrl: "https://cdn.resend.app/a1", filename: "doc.pdf" }
        : { ok: false, reason: "expired" },
    );
  });

  it("attaches originals via signed URL and notes missing ones", async () => {
    const { client, calls } = admin();
    const r = await sendForward(
      client as unknown as SupabaseClient,
      { threadId: "t1", to: "Bob <bob@example.com>", bodyText: "Mira esto" },
      { emails: { send, get } } as unknown as Resend,
    );
    expect(r).toEqual({ sent: true, messageId: "out-1", attached: 1, missing: ["old.png"] });
    const arg = send.mock.calls[0][0];
    expect(arg.to).toBe("bob@example.com");
    expect(arg.subject).toBe("Fwd: Presupuesto");
    expect(arg.attachments).toEqual([{ path: "https://cdn.resend.app/a1", filename: "doc.pdf" }]);
    const ins = calls.find((c) => c.op === "insert")?.payload as Record<string, unknown>;
    expect(ins.message_id).toBe("<ses@amazonses.com>");
    expect(ins.thread_id).toBe("t1");
  });

  it("refuses forwarding to our own mailbox", async () => {
    const { client } = admin();
    const r = await sendForward(
      client as unknown as SupabaseClient,
      { threadId: "t1", to: "hola@galladev.com", bodyText: "" },
      { emails: { send, get } } as unknown as Resend,
    );
    expect(r).toMatchObject({ sent: false, reason: "invalid-recipient" });
    expect(send).not.toHaveBeenCalled();
  });
});
