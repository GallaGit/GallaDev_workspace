import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("./resend-client", () => ({
  getResendClient: vi.fn(() => ({
    emails: { send: sendMock },
  })),
}));

import { sendReply } from "./send-reply";

function mockAdmin(overrides: {
  thread?: Record<string, unknown> | null;
  messages?: Array<Record<string, unknown>>;
  insertResult?: { id: string } | null;
  insertError?: { code: string; message: string } | null;
  countResult?: number;
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
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: insertResult,
                error: insertError,
              }),
            }),
          }),
        };
      }
      return {};
    }),
  } as unknown as Parameters<typeof sendReply>[0];
}

describe("sendReply", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: "re_sent_123" }, error: null });
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
    expect(inserted?.message_id).toMatch(/^<[0-9a-f-]{36}@galladev\.com>$/i);
    expect(sendMock.mock.calls[0][0].headers["Message-ID"]).toBe(
      inserted?.message_id,
    );
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
});
