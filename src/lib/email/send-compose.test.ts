import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("./resend-client", () => ({
  getResendClient: vi.fn(() => ({
    emails: { send: sendMock },
  })),
}));

import { sendCompose, isValidExternalEmail } from "./send-compose";

function mockAdmin(overrides: {
  threadId?: string;
  messageId?: string;
  threadError?: { message: string } | null;
  messageError?: { message: string } | null;
  deleteDraft?: ReturnType<typeof vi.fn>;
} = {}) {
  const threadId = overrides.threadId ?? "thread-new-1";
  const messageId = overrides.messageId ?? "msg-new-1";
  const deleteDraft =
    overrides.deleteDraft ??
    vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "email_threads") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: overrides.threadError ? null : { id: threadId },
                error: overrides.threadError ?? null,
              }),
            }),
          }),
        };
      }
      if (table === "email_messages") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: overrides.messageError ? null : { id: messageId },
                error: overrides.messageError ?? null,
              }),
            }),
          }),
        };
      }
      if (table === "email_drafts") {
        return { delete: deleteDraft };
      }
      return {};
    }),
    _deleteDraft: deleteDraft,
  } as unknown as Parameters<typeof sendCompose>[0] & {
    _deleteDraft: ReturnType<typeof vi.fn>;
  };
}

describe("isValidExternalEmail", () => {
  it("accepts bare and angle-bracket emails", () => {
    expect(isValidExternalEmail("a@b.com")).toBe(true);
    expect(isValidExternalEmail("Name <a@b.com>")).toBe(true);
  });

  it("rejects garbage", () => {
    expect(isValidExternalEmail("")).toBe(false);
    expect(isValidExternalEmail("not-an-email")).toBe(false);
  });
});

describe("sendCompose", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: "re_compose_1" }, error: null });
  });

  it("sends from the chosen mailbox and creates a thread", async () => {
    const admin = mockAdmin();
    const result = await sendCompose(admin, {
      mailbox: "ociel@galladev.com",
      to: "client@example.com",
      subject: "Hello",
      bodyText: "Body here",
    });

    expect(result.sent).toBe(true);
    if (result.sent) {
      expect(result.threadId).toBe("thread-new-1");
      expect(result.messageId).toBe("msg-new-1");
    }
    const call = sendMock.mock.calls[0][0];
    expect(call.headers["Message-ID"]).toMatch(
      /^<[0-9a-f-]{36}@galladev\.com>$/i,
    );
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Ociel <ociel@galladev.com>",
        to: "client@example.com",
        subject: "Hello",
        text: "Body here",
      }),
    );
  });

  it("deletes draft only after successful send", async () => {
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const deleteDraft = vi.fn().mockReturnValue({ eq: deleteEq });
    const admin = mockAdmin({ deleteDraft });

    await sendCompose(admin, {
      mailbox: "hola@galladev.com",
      to: "x@y.com",
      subject: "S",
      bodyText: "B",
      draftId: "draft-1",
    });

    expect(deleteDraft).toHaveBeenCalled();
    expect(deleteEq).toHaveBeenCalledWith("id", "draft-1");
  });

  it("does not delete draft when Resend fails", async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { message: "quota exceeded" },
    });
    const deleteDraft = vi.fn();
    const admin = mockAdmin({ deleteDraft });

    const result = await sendCompose(admin, {
      mailbox: "hola@galladev.com",
      to: "x@y.com",
      subject: "S",
      bodyText: "B",
      draftId: "draft-1",
    });

    expect(result.sent).toBe(false);
    expect(deleteDraft).not.toHaveBeenCalled();
  });

  it("rejects invalid to", async () => {
    const admin = mockAdmin();
    const result = await sendCompose(admin, {
      mailbox: "hola@galladev.com",
      to: "bad",
      subject: "S",
      bodyText: "B",
    });
    expect(result).toEqual({ sent: false, reason: "invalid-to" });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects empty body", async () => {
    const admin = mockAdmin();
    const result = await sendCompose(admin, {
      mailbox: "hola@galladev.com",
      to: "x@y.com",
      subject: "S",
      bodyText: "   ",
    });
    expect(result).toEqual({ sent: false, reason: "empty-body" });
  });

  it("returns no-client when Resend missing", async () => {
    const { getResendClient } = await import("./resend-client");
    vi.mocked(getResendClient).mockReturnValueOnce(null);
    const admin = mockAdmin();
    const result = await sendCompose(admin, {
      mailbox: "hola@galladev.com",
      to: "x@y.com",
      subject: "S",
      bodyText: "B",
    });
    expect(result).toEqual({ sent: false, reason: "no-client" });
  });
});
