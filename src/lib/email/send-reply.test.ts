import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();
const getMock = vi.hoisted(() => vi.fn());
const autoLinkThread = vi.hoisted(() =>
  vi.fn(async () => ({ status: "skipped", reason: "no-match" })),
);

vi.mock("./lead-link", () => ({ autoLinkThread }));

const listAttachmentsMock = vi.hoisted(() => vi.fn());

vi.mock("./resend-client", () => ({
  getResendClient: vi.fn(() => ({
    emails: {
      send: sendMock,
      get: getMock,
      attachments: { list: listAttachmentsMock },
    },
  })),
}));

import { sendReply } from "./send-reply";

function mockAdmin(overrides: {
  thread?: Record<string, unknown> | null;
  messages?: Array<Record<string, unknown>>;
  insertResult?: { id: string } | null;
  insertError?: { code: string; message: string } | null;
  countResult?: number;
  messageInsertSpy?: ReturnType<typeof vi.fn>;
  attachmentsInsert?: ReturnType<typeof vi.fn>;
} = {}) {
  const thread =
    overrides.thread ?? {
      id: "t-1",
      subject: "Test Subject",
      from_address: "sender@example.com",
      mailbox_address: "hola@galladev.com",
    };
  const messages = overrides.messages ?? [
    { message_id: "<msg-1@example.com>", direction: "inbound", from_address: "sender@example.com", to_addresses: ["hola@galladev.com"] },
  ];
  const insertResult = overrides.insertResult ?? { id: "new-msg-1" };
  const insertError = overrides.insertError ?? null;
  const countResult = overrides.countResult ?? 2;
  const messageInsert = overrides.messageInsertSpy ?? vi.fn();
  messageInsert.mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: insertResult, error: insertError }),
    }),
  });

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "email_threads") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: thread, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === "email_messages") {
        return {
          select: vi.fn().mockImplementation((cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.head) {
              return {
                eq: vi.fn().mockResolvedValue({ count: countResult }),
              };
            }
            return {
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: messages, error: null }),
              }),
            };
          }),
          insert: messageInsert,
        };
      }
      if (table === "email_attachments") {
        return {
          insert: overrides.attachmentsInsert ?? vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    }),
  } as unknown as Parameters<typeof sendReply>[0];
}

describe("sendReply", () => {
  beforeEach(() => {
    sendMock.mockReset();
    autoLinkThread.mockClear();
    getMock.mockReset();
    getMock.mockResolvedValue({
      data: { message_id: "<0102-real@eu-west-1.amazonses.com>" },
      error: null,
    });
    sendMock.mockResolvedValue({ data: { id: "re_sent_123" }, error: null });
    listAttachmentsMock.mockReset();
    listAttachmentsMock.mockResolvedValue({
      data: { data: [{ id: "ra-9", filename: "nota.txt" }] },
      error: null,
    });
  });

  it("sends reply with In-Reply-To, References, and own Message-ID", async () => {
    const admin = mockAdmin();
    const result = await sendReply(admin, {
      threadId: "t-1",
      bodyText: "Thanks for writing!",
    });

    expect(result.sent).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);

    const call = sendMock.mock.calls[0][0];
    expect(call.from).toContain("hola@galladev.com");
    expect(call.to).toBe("sender@example.com");
    expect(call.subject).toBe("Re: Test Subject");
    expect(call.text).toBe("Thanks for writing!");
    expect(call.headers["In-Reply-To"]).toBe("<msg-1@example.com>");
    expect(call.headers.References).toBe("<msg-1@example.com>");
    expect(call.headers["Message-ID"]).toMatch(
      /^<[0-9a-f-]{36}@galladev\.com>$/i,
    );
    expect(result.sent && result.messageId).toBe("new-msg-1");
  });

  it("persists the outbound Message-ID on the stored message", async () => {
    let inserted: Record<string, unknown> | undefined;
    const base = mockAdmin();
    const baseFrom = base.from as unknown as (table: string) => {
      insert?: (row: Record<string, unknown>) => unknown;
      [key: string]: unknown;
    };
    const admin = {
      from: vi.fn().mockImplementation((table: string) => {
        const inner = baseFrom(table);
        if (table === "email_messages" && typeof inner.insert === "function") {
          const originalInsert = inner.insert.bind(inner);
          return {
            ...inner,
            insert: (row: Record<string, unknown>) => {
              inserted = row;
              return originalInsert(row);
            },
          };
        }
        return inner;
      }),
    } as unknown as Parameters<typeof sendReply>[0];

    await sendReply(admin, { threadId: "t-1", bodyText: "Thanks" });
    // Root cause of split threads: Resend/SES rewrites Message-ID, so we
    // store the real one from emails.get (what the recipient replies to).
    expect(getMock).toHaveBeenCalledWith("re_sent_123");
    expect(inserted?.message_id).toBe("<0102-real@eu-west-1.amazonses.com>");
  });

  it("falls back to our own Message-ID if Resend has no message_id yet", async () => {
    getMock.mockResolvedValue({ data: null, error: { name: "not_found" } });
    let inserted: Record<string, unknown> | undefined;
    const base = mockAdmin();
    const baseFrom = base.from as unknown as (t: string) => Record<string, unknown>;
    const admin = {
      from: (table: string) => {
        const inner = baseFrom(table) as { insert?: (r: Record<string, unknown>) => unknown };
        if (table === "email_messages" && inner.insert) {
          const orig = inner.insert;
          return { ...inner, insert: (r: Record<string, unknown>) => { inserted = r; return orig(r); } };
        }
        return inner;
      },
    } as unknown as Parameters<typeof sendReply>[0];
    await sendReply(admin, { threadId: "t-1", bodyText: "Thanks" });
    expect(inserted?.message_id).toBe(sendMock.mock.calls[0][0].headers["Message-ID"]);
  });

  it("reply-all sends to sender + To and Cc minus our mailboxes", async () => {
    const admin = mockAdmin({
      messages: [
        {
          message_id: "<m1@x>",
          direction: "inbound",
          from_address: "sender@example.com",
          to_addresses: ["hola@galladev.com", "bob@example.com"],
          cc_addresses: ["carol@example.com", "ociel@galladev.com", "bob@example.com"],
        },
      ],
    });
    const result = await sendReply(admin, { threadId: "t-1", bodyText: "Hi all", mode: "replyAll" });
    expect(result.sent).toBe(true);
    const call = sendMock.mock.calls[0][0];
    expect(call.to).toEqual(["sender@example.com", "bob@example.com"]);
    expect(call.cc).toEqual(["carol@example.com"]);
  });

  it("intenta vincular el hilo con el lead de los destinatarios tras enviar", async () => {
    const admin = mockAdmin({
      messages: [
        {
          message_id: "<m1@x>",
          direction: "inbound",
          from_address: "Sender@Example.com",
          to_addresses: ["hola@galladev.com", "bob@example.com"],
          cc_addresses: ["carol@example.com"],
        },
      ],
    });
    await sendReply(admin, { threadId: "t-1", bodyText: "Hi all", mode: "replyAll" });
    expect(autoLinkThread).toHaveBeenCalledWith(admin, "t-1", [
      "sender@example.com",
      "bob@example.com",
      "carol@example.com",
    ]);
  });

  it("no intenta vincular si el envío falla", async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: "quota" } });
    await sendReply(mockAdmin(), { threadId: "t-1", bodyText: "Hi" });
    expect(autoLinkThread).not.toHaveBeenCalled();
  });

  it("sends from ociel@ when thread mailbox is ociel@", async () => {
    const admin = mockAdmin({
      thread: {
        id: "t-2",
        subject: "Personal note",
        from_address: "friend@example.com",
        mailbox_address: "ociel@galladev.com",
      },
      messages: [
        {
          message_id: "<msg-p@example.com>",
          direction: "inbound",
          from_address: "friend@example.com",
          to_addresses: ["ociel@galladev.com"],
        },
      ],
    });
    await sendReply(admin, { threadId: "t-2", bodyText: "Got it" });
    const call = sendMock.mock.calls[0][0];
    expect(call.from).toBe("Ociel <ociel@galladev.com>");
  });

  it("does not double Re: prefix", async () => {
    const admin = mockAdmin({
      thread: {
        id: "t-1",
        subject: "Re: Already replied",
        from_address: "sender@example.com",
        mailbox_address: "hola@galladev.com",
      },
    });
    await sendReply(admin, { threadId: "t-1", bodyText: "Another reply" });

    const call = sendMock.mock.calls[0][0];
    expect(call.subject).toBe("Re: Already replied");
    expect(call.subject).not.toContain("Re: Re:");
  });

  it("returns no-client when Resend not configured", async () => {
    const { getResendClient } = await import("./resend-client");
    vi.mocked(getResendClient).mockReturnValueOnce(null);

    const admin = mockAdmin();
    const result = await sendReply(admin, { threadId: "t-1", bodyText: "Hi" });
    expect(result).toEqual({ sent: false, reason: "no-client" });
  });

  it("rechecks the stored sender and sends only the address", async () => {
    const admin = mockAdmin({
      messages: [
        {
          message_id: "<msg-1@example.com>",
          direction: "inbound",
          from_address: "Sender <sender@example.com>",
          to_addresses: ["hola@galladev.com"],
        },
      ],
    });
    const result = await sendReply(admin, { threadId: "t-1", bodyText: "Hi" });
    expect(result.sent).toBe(true);
    expect(sendMock.mock.calls[0][0].to).toBe("sender@example.com");
  });

  it("does not send when the stored recipient is not an email", async () => {
    const admin = mockAdmin({
      thread: {
        id: "t-1",
        subject: "Test Subject",
        from_address: "not-an-email",
        mailbox_address: "hola@galladev.com",
      },
      messages: [],
    });
    const result = await sendReply(admin, { threadId: "t-1", bodyText: "Hi" });
    expect(result).toEqual({ sent: false, reason: "invalid-recipient" });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("does not send from a mailbox outside the allowlist", async () => {
    const admin = mockAdmin({
      thread: {
        id: "t-1",
        subject: "Test Subject",
        from_address: "sender@example.com",
        mailbox_address: "otro@galladev.com",
      },
    });
    const result = await sendReply(admin, { threadId: "t-1", bodyText: "Hi" });
    expect(result).toEqual({ sent: false, reason: "invalid-mailbox" });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns send-failed on Resend error", async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: "quota exceeded" } });

    const admin = mockAdmin();
    const result = await sendReply(admin, { threadId: "t-1", bodyText: "Hi" });
    expect(result.sent).toBe(false);
    if (!result.sent) {
      expect(result.reason).toBe("send-failed");
    }
  });

  it("suma Cc/Cco extra a los de «Responder a todos» sin duplicar y los guarda", async () => {
    const messageInsertSpy = vi.fn();
    const admin = mockAdmin({
      messageInsertSpy,
      messages: [
        {
          message_id: "<msg-1@example.com>",
          direction: "inbound",
          from_address: "sender@example.com",
          to_addresses: ["hola@galladev.com", "otra@example.com"],
          cc_addresses: ["copia@example.com"],
        },
      ],
    });
    const result = await sendReply(admin, {
      threadId: "t-1",
      bodyText: "Hola",
      mode: "replyAll",
      cc: ["extra@example.com", "copia@example.com", "sender@example.com"],
      bcc: ["oculto@example.com", "extra@example.com"],
    });
    expect(result.sent).toBe(true);
    const call = sendMock.mock.calls[0][0];
    expect(call.to).toEqual(["sender@example.com", "otra@example.com"]);
    expect(call.cc).toEqual(["copia@example.com", "extra@example.com"]);
    expect(call.bcc).toEqual(["oculto@example.com"]);
    expect(messageInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cc_addresses: ["copia@example.com", "extra@example.com"],
        bcc_addresses: ["oculto@example.com"],
      }),
    );
  });

  it("responde con Cco aunque no sea «Responder a todos»", async () => {
    await sendReply(mockAdmin(), {
      threadId: "t-1",
      bodyText: "Hola",
      bcc: ["oculto@example.com"],
    });
    const call = sendMock.mock.calls[0][0];
    expect(call.to).toBe("sender@example.com");
    expect(call).not.toHaveProperty("cc");
    expect(call.bcc).toEqual(["oculto@example.com"]);
  });

  it("rechaza Cc no válido sin enviar", async () => {
    const result = await sendReply(mockAdmin(), {
      threadId: "t-1",
      bodyText: "Hola",
      cc: ["nope"],
    });
    expect(result).toEqual({ sent: false, reason: "invalid-recipient" });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("envía adjuntos y guarda sus metadatos; rechaza los no permitidos", async () => {
    const attachmentsInsert = vi.fn().mockResolvedValue({ error: null });
    const ok = await sendReply(mockAdmin({ attachmentsInsert }), {
      threadId: "t-1",
      bodyText: "Hola",
      attachments: [{ filename: "nota.txt", contentType: "text/plain", content: Buffer.from("hola") }],
    });
    expect(ok.sent).toBe(true);
    expect(sendMock.mock.calls[0][0].attachments).toEqual([
      { filename: "nota.txt", content: Buffer.from("hola"), contentType: "text/plain" },
    ]);
    const rows = attachmentsInsert.mock.calls[0][0] as Record<string, unknown>[];
    expect(rows[0]).toMatchObject({
      message_id: "new-msg-1",
      resend_attachment_id: "ra-9",
      filename: "nota.txt",
    });

    sendMock.mockClear();
    const bad = await sendReply(mockAdmin(), {
      threadId: "t-1",
      bodyText: "Hola",
      attachments: [{ filename: "x.bat", contentType: "text/plain", content: Buffer.from("x") }],
    });
    expect(bad).toEqual({ sent: false, reason: "invalid-attachments" });
    expect(sendMock).not.toHaveBeenCalled();
  });
});
