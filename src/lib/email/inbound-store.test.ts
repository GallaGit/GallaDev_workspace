import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchReceivingEmail = vi.hoisted(() => vi.fn());
const findThreadForMessage = vi.hoisted(() => vi.fn());

vi.mock("./thread-match", () => ({ findThreadForMessage }));

vi.mock("./receiving-fetch", () => ({
  fetchReceivingEmail,
  threadingFromHeaders: (
    headers: Record<string, string> | null | undefined,
  ) => {
    if (!headers) return { inReplyTo: null, references: null };
    const lower = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
    );
    return {
      inReplyTo: lower["in-reply-to"]?.trim() || null,
      references: lower.references?.trim() || null,
    };
  },
}));

vi.mock("./sanitize-email-html", () => ({
  prepareStoredEmailBodies: (html?: string | null, text?: string | null) => ({
    html: html ?? null,
    text: text ?? null,
  }),
}));

import { storeInboundEmail } from "./inbound-store";

function mockAdmin(opts: {
  existingMessage?: { id: string } | null;
  existingThreadByRef?: { thread_id: string } | null;
  sameMessageId?: { thread_id: string } | null;
  insertMessage?: { id: string } | null;
  insertMessageError?: { code?: string; message?: string } | null;
  insertThread?: { id: string } | null;
  messageCount?: number;
} = {}) {
  const existingMessage = opts.existingMessage ?? null;
  const existingThreadByRef = opts.existingThreadByRef ?? null;
  const insertMessage = opts.insertMessage ?? { id: "msg-new" };
  const insertMessageError = opts.insertMessageError ?? null;
  const insertThread = opts.insertThread ?? { id: "thread-new" };
  const messageCount = opts.messageCount ?? 1;
  const sameMessageId = opts.sameMessageId ?? null;
  findThreadForMessage.mockResolvedValue(
    existingThreadByRef
      ? { threadId: existingThreadByRef.thread_id, via: "in-reply-to" }
      : null,
  );

  const messageInsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: insertMessageError ? null : insertMessage,
        error: insertMessageError,
      }),
    }),
  });

  const attachmentInsert = vi.fn().mockResolvedValue({ error: null });

  const threadInsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: insertThread,
        error: insertThread ? null : { message: "fail" },
      }),
    }),
  });

  const threadUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });

  let messageSelectCalls = 0;

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "email_messages") {
        return {
          select: vi.fn().mockImplementation((cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.head) {
              return {
                eq: vi.fn().mockResolvedValue({ count: messageCount }),
              };
            }
            messageSelectCalls += 1;
            // First select: duplicate check by resend_email_id
            if (messageSelectCalls === 1) {
              return {
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: existingMessage,
                    error: null,
                  }),
                }),
              };
            }
            // Later: same Message-ID already stored
            return {
              in: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: sameMessageId,
                    error: null,
                  }),
                }),
              }),
            };
          }),
          insert: messageInsert,
        };
      }
      if (table === "email_threads") {
        return {
          insert: threadInsert,
          update: threadUpdate,
        };
      }
      if (table === "email_attachments") {
        return { insert: attachmentInsert };
      }
      return {};
    }),
    _messageInsert: messageInsert,
    _attachmentInsert: attachmentInsert,
    _threadInsert: threadInsert,
  } as unknown as Parameters<typeof storeInboundEmail>[0] & {
    _messageInsert: ReturnType<typeof vi.fn>;
    _attachmentInsert: ReturnType<typeof vi.fn>;
    _threadInsert: ReturnType<typeof vi.fn>;
  };
}

const baseEvent = {
  type: "email.received" as const,
  data: {
    email_id: "em_abc",
    message_id: "<new@example.com>",
    from: "Client <client@example.com>",
    to: ["hola@galladev.com"],
    subject: "Hello",
    created_at: "2026-10-01T12:00:00.000Z",
  },
};

describe("storeInboundEmail", () => {
  beforeEach(() => {
    fetchReceivingEmail.mockReset();
    findThreadForMessage.mockReset();
  });

  it("passes In-Reply-To, References, subject and sender to the matcher", async () => {
    fetchReceivingEmail.mockResolvedValue({
      ok: true,
      data: {
        html: null,
        text: "x",
        headers: {
          "In-Reply-To": "<ses-id@eu-west-1.amazonses.com>",
          References: "<a@x>\r\n <ses-id@eu-west-1.amazonses.com>",
        },
        messageId: "<new@example.com>",
        attachments: [],
      },
    });
    const admin = mockAdmin({ existingThreadByRef: { thread_id: "t-1" } });
    const result = await storeInboundEmail(admin, {
      ...baseEvent,
      data: { ...baseEvent.data, subject: "Re: Hello" },
    });
    expect(result).toMatchObject({ stored: true, threadId: "t-1" });
    expect(findThreadForMessage).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        inReplyTo: "<ses-id@eu-west-1.amazonses.com>",
        subject: "Re: Hello",
        counterpart: "client@example.com",
        mailbox: "hola@galladev.com",
      }),
    );
  });

  it("reuses the thread when the same Message-ID is already stored", async () => {
    fetchReceivingEmail.mockResolvedValue({ ok: false, errorName: "x" });
    const admin = mockAdmin({ sameMessageId: { thread_id: "t-same" } });
    const result = await storeInboundEmail(admin, baseEvent);
    expect(result).toMatchObject({ stored: true, threadId: "t-same" });
    expect(findThreadForMessage).not.toHaveBeenCalled();
  });

  it("stores html/text from Receiving API and threads via headers", async () => {
    fetchReceivingEmail.mockResolvedValue({
      ok: true,
      data: {
        html: "<p>Body</p>",
        text: "Body",
        headers: {
          "in-reply-to": "<parent@example.com>",
          references: "<root@example.com> <parent@example.com>",
        },
        messageId: "<new@example.com>",
        attachments: [],
      },
    });

    const admin = mockAdmin({
      existingThreadByRef: { thread_id: "thread-existing" },
    });

    const result = await storeInboundEmail(admin, baseEvent);
    expect(result).toEqual({
      stored: true,
      threadId: "thread-existing",
      messageId: "msg-new",
    });
    expect(fetchReceivingEmail).toHaveBeenCalledTimes(1);
    expect(fetchReceivingEmail).toHaveBeenCalledWith("em_abc");

    const inserted = admin._messageInsert.mock.calls[0][0];
    expect(inserted.body_html).toBe("<p>Body</p>");
    expect(inserted.body_text).toBe("Body");
    expect(inserted.in_reply_to).toBe("<parent@example.com>");
    expect(inserted.references).toBe(
      "<root@example.com> <parent@example.com>",
    );
    expect(admin._threadInsert).not.toHaveBeenCalled();
  });

  it("stores null bodies when Receiving API returns error (already logged)", async () => {
    fetchReceivingEmail.mockResolvedValue({
      ok: false,
      status: 401,
      errorName: "validation_error",
    });

    const admin = mockAdmin();
    const result = await storeInboundEmail(admin, baseEvent);
    expect(result.stored).toBe(true);

    const inserted = admin._messageInsert.mock.calls[0][0];
    expect(inserted.body_html).toBeNull();
    expect(inserted.body_text).toBeNull();
    expect(inserted.in_reply_to).toBeNull();
    expect(admin._threadInsert).toHaveBeenCalled();
  });

  it("threads only from headers, not inventing top-level in_reply_to", async () => {
    // Regression: SDK v6 puts threading only in headers.
    fetchReceivingEmail.mockResolvedValue({
      ok: true,
      data: {
        html: "x",
        text: "x",
        headers: { "in-reply-to": "<from-headers@example.com>" },
        messageId: "<new@example.com>",
        attachments: [],
      },
    });

    const admin = mockAdmin({
      existingThreadByRef: { thread_id: "t-headers" },
    });
    await storeInboundEmail(admin, baseEvent);
    const inserted = admin._messageInsert.mock.calls[0][0];
    expect(inserted.in_reply_to).toBe("<from-headers@example.com>");
  });

  it("returns duplicate when resend_email_id already exists", async () => {
    const admin = mockAdmin({ existingMessage: { id: "already" } });
    const result = await storeInboundEmail(admin, baseEvent);
    expect(result).toEqual({ stored: false, reason: "duplicate" });
    expect(fetchReceivingEmail).not.toHaveBeenCalled();
  });

  it("stores attachment size_bytes from Receiving API when present", async () => {
    fetchReceivingEmail.mockResolvedValue({
      ok: true,
      data: {
        html: null,
        text: "hi",
        headers: null,
        messageId: "<new@example.com>",
        attachments: [
          {
            id: "att-1",
            filename: "doc.pdf",
            content_type: "application/pdf",
            size: 1200,
          },
        ],
      },
    });

    const admin = mockAdmin();
    await storeInboundEmail(admin, {
      ...baseEvent,
      data: {
        ...baseEvent.data,
        attachments: [
          {
            id: "att-1",
            filename: "doc.pdf",
            content_type: "application/pdf",
          },
        ],
      },
    });

    expect(admin._attachmentInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        resend_attachment_id: "att-1",
        size_bytes: 1200,
      }),
    ]);
  });
});
