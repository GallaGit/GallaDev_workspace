import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();
const getMock = vi.hoisted(() => vi.fn());
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

import { sendCompose, isValidExternalEmail } from "./send-compose";

function mockAdmin(overrides: {
  threadId?: string;
  messageId?: string;
  threadError?: { message: string } | null;
  messageError?: { message: string } | null;
  deleteDraft?: ReturnType<typeof vi.fn>;
  attachmentsInsert?: ReturnType<typeof vi.fn>;
  messageInsert?: ReturnType<typeof vi.fn>;
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
      if (table === "email_attachments") {
        return {
          insert:
            overrides.attachmentsInsert ??
            vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === "email_messages") {
        return {
          insert: overrides.messageInsert ?? vi.fn().mockReturnValue({
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
    getMock.mockReset();
    getMock.mockResolvedValue({
      data: { message_id: "<0102-real@eu-west-1.amazonses.com>" },
      error: null,
    });
    sendMock.mockResolvedValue({ data: { id: "re_compose_1" }, error: null });
    listAttachmentsMock.mockReset();
    listAttachmentsMock.mockResolvedValue({
      data: { data: [{ id: "ra-1", filename: "nota.txt" }] },
      error: null,
    });
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

  it("envía Cc y Cco por Resend (sin duplicados con Para) y los guarda en el mensaje", async () => {
    const messageInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "msg-cc" }, error: null }),
      }),
    });
    const admin = mockAdmin({ messageInsert });
    const result = await sendCompose(admin, {
      mailbox: "hola@galladev.com",
      to: "client@example.com",
      cc: ["Ana <ANA@example.com>", "client@example.com"],
      bcc: ["jefe@example.com", "ana@example.com"],
      subject: "Hola",
      bodyText: "Cuerpo",
    });
    expect(result.sent).toBe(true);
    const call = sendMock.mock.calls[0][0];
    expect(call.to).toBe("client@example.com");
    expect(call.cc).toEqual(["ana@example.com"]);
    expect(call.bcc).toEqual(["jefe@example.com"]);
    expect(messageInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        to_addresses: ["client@example.com"],
        cc_addresses: ["ana@example.com"],
        bcc_addresses: ["jefe@example.com"],
      }),
    );
  });

  it("no envía claves cc/bcc si no hay copias", async () => {
    await sendCompose(mockAdmin(), {
      mailbox: "hola@galladev.com",
      to: "client@example.com",
      subject: "Hola",
      bodyText: "Cuerpo",
    });
    const call = sendMock.mock.calls[0][0];
    expect(call).not.toHaveProperty("cc");
    expect(call).not.toHaveProperty("bcc");
    expect(call).not.toHaveProperty("attachments");
  });

  it("rechaza Cc o Cco no válidos sin llamar a Resend", async () => {
    const base = {
      mailbox: "hola@galladev.com" as const,
      to: "client@example.com",
      subject: "S",
      bodyText: "B",
    };
    expect(await sendCompose(mockAdmin(), { ...base, cc: ["nope"] })).toEqual({
      sent: false,
      reason: "invalid-cc",
    });
    expect(await sendCompose(mockAdmin(), { ...base, bcc: ["a@b"] })).toEqual({
      sent: false,
      reason: "invalid-bcc",
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("envía adjuntos como attachments de Resend y guarda sus metadatos", async () => {
    const attachmentsInsert = vi.fn().mockResolvedValue({ error: null });
    const admin = mockAdmin({ attachmentsInsert });
    const result = await sendCompose(admin, {
      mailbox: "hola@galladev.com",
      to: "client@example.com",
      subject: "Con adjunto",
      bodyText: "Mira",
      attachments: [
        { filename: "nota.txt", contentType: "text/plain", content: Buffer.from("hola") },
      ],
    });
    expect(result.sent).toBe(true);
    expect(sendMock.mock.calls[0][0].attachments).toEqual([
      { filename: "nota.txt", content: Buffer.from("hola"), contentType: "text/plain" },
    ]);
    expect(attachmentsInsert).toHaveBeenCalledTimes(1);
    const rows = attachmentsInsert.mock.calls[0][0] as Record<string, unknown>[];
    expect(rows[0]).toMatchObject({
      message_id: "msg-new-1",
      resend_attachment_id: "ra-1",
      filename: "nota.txt",
      content_type: "text/plain",
      size_bytes: 4,
    });
  });

  it("rechaza adjuntos no permitidos antes de enviar", async () => {
    const result = await sendCompose(mockAdmin(), {
      mailbox: "hola@galladev.com",
      to: "client@example.com",
      subject: "S",
      bodyText: "B",
      attachments: [
        { filename: "x.exe", contentType: "application/octet-stream", content: Buffer.from("x") },
      ],
    });
    expect(result).toEqual({ sent: false, reason: "invalid-attachments" });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("un fallo al guardar adjuntos no tumba un correo ya enviado", async () => {
    const attachmentsInsert = vi.fn().mockRejectedValue(new Error("db down"));
    const result = await sendCompose(mockAdmin({ attachmentsInsert }), {
      mailbox: "hola@galladev.com",
      to: "client@example.com",
      subject: "S",
      bodyText: "B",
      attachments: [
        { filename: "nota.txt", contentType: "text/plain", content: Buffer.from("hola") },
      ],
    });
    expect(result.sent).toBe(true);
  });
});
