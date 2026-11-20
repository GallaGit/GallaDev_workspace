import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./resend-client", () => ({ getResendClient: () => null }));

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resend } from "resend";
import {
  attachmentsAreValid,
  storeOutboundAttachments,
  toResendAttachments,
  type OutboundAttachment,
} from "./outbound-attachments-store";
import { MAX_OUTBOUND_ATTACHMENT_BYTES } from "./outbound-attachments";

const MESSAGE_ID = "11111111-2222-4333-8444-555555555555";

function file(name: string, size = 4, contentType = "application/pdf"): OutboundAttachment {
  return { filename: name, contentType, content: Buffer.alloc(size, 1) };
}

function mockAdmin(opts: { insertError?: { message: string } | null; uploadError?: { message: string } | null } = {}) {
  const insert = vi.fn().mockResolvedValue({ error: opts.insertError ?? null });
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const upload = vi.fn().mockResolvedValue({ error: opts.uploadError ?? null });
  const storageFrom = vi.fn(() => ({ upload }));
  const admin = {
    from: vi.fn((table: string) => (table === "email_attachments" ? { insert, update } : {})),
    storage: { from: storageFrom },
  } as unknown as SupabaseClient;
  return { admin, insert, update, updateEq, upload, storageFrom };
}

function resendClient(list: unknown) {
  return {
    emails: { attachments: { list: vi.fn().mockImplementation(async () => list) } },
  } as unknown as Resend;
}

describe("toResendAttachments / attachmentsAreValid", () => {
  it("convierte al formato de Resend", () => {
    const out = toResendAttachments([file("a.pdf")]);
    expect(out).toEqual([
      { filename: "a.pdf", content: expect.any(Buffer), contentType: "application/pdf" },
    ]);
  });

  it("revalida el conjunto en el servidor", () => {
    expect(attachmentsAreValid([file("a.pdf")])).toBe(true);
    expect(attachmentsAreValid([file("a.exe")])).toBe(false);
    expect(attachmentsAreValid([file("a.bin", MAX_OUTBOUND_ATTACHMENT_BYTES + 1)])).toBe(false);
  });
});

describe("storeOutboundAttachments", () => {
  beforeEach(() => {
    delete process.env.EMAIL_ATTACHMENTS_BUCKET;
  });
  afterEach(() => {
    delete process.env.EMAIL_ATTACHMENTS_BUCKET;
  });

  it("sin ficheros no toca nada", async () => {
    const { admin, insert } = mockAdmin();
    await storeOutboundAttachments(admin, resendClient({ data: { data: [] } }), {
      messageId: MESSAGE_ID,
      resendEmailId: "re_1",
      files: [],
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("sin bucket guarda solo metadatos (con el id de Resend si se puede leer) y no sube bytes", async () => {
    const { admin, insert, upload } = mockAdmin();
    await storeOutboundAttachments(
      admin,
      resendClient({ data: { data: [{ id: "ra-1", filename: "a.pdf" }] } }),
      { messageId: MESSAGE_ID, resendEmailId: "re_1", files: [file("a.pdf", 10)] },
    );
    expect(insert).toHaveBeenCalledTimes(1);
    const rows = insert.mock.calls[0][0] as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      message_id: MESSAGE_ID,
      resend_attachment_id: "ra-1",
      filename: "a.pdf",
      content_type: "application/pdf",
      size_bytes: 10,
    });
    expect(rows[0]).not.toHaveProperty("storage_path");
    expect(upload).not.toHaveBeenCalled();
  });

  it("si Resend no devuelve la lista, guarda metadatos con resend_attachment_id null", async () => {
    const { admin, insert } = mockAdmin();
    const client = {
      emails: { attachments: { list: vi.fn().mockRejectedValue(new Error("boom")) } },
    } as unknown as Resend;
    await storeOutboundAttachments(admin, client, {
      messageId: MESSAGE_ID,
      resendEmailId: "re_1",
      files: [file("a.pdf")],
    });
    const rows = insert.mock.calls[0][0] as Record<string, unknown>[];
    expect(rows[0].resend_attachment_id).toBeNull();
  });

  it("con bucket sube los bytes a una ruta opaca y guarda storage_path", async () => {
    process.env.EMAIL_ATTACHMENTS_BUCKET = "correo-adjuntos";
    const { admin, insert, upload, storageFrom, update, updateEq } = mockAdmin();
    await storeOutboundAttachments(admin, resendClient({ data: { data: [] } }), {
      messageId: MESSAGE_ID,
      resendEmailId: "re_1",
      files: [file("secreto-factura.pdf", 8)],
    });
    const rows = insert.mock.calls[0][0] as { id: string }[];
    expect(storageFrom).toHaveBeenCalledWith("correo-adjuntos");
    const path = `email/${MESSAGE_ID}/${rows[0].id}`;
    expect(upload).toHaveBeenCalledWith(
      path,
      expect.any(Buffer),
      expect.objectContaining({ contentType: "application/pdf", upsert: false }),
    );
    expect(path).not.toContain("secreto");
    expect(update).toHaveBeenCalledWith({ storage_path: path });
    expect(updateEq).toHaveBeenCalledWith("id", rows[0].id);
  });

  it("si falla la subida no lanza ni guarda storage_path", async () => {
    process.env.EMAIL_ATTACHMENTS_BUCKET = "correo-adjuntos";
    const { admin, update } = mockAdmin({ uploadError: { message: "x" } });
    await expect(
      storeOutboundAttachments(admin, resendClient({ data: { data: [] } }), {
        messageId: MESSAGE_ID,
        resendEmailId: "re_1",
        files: [file("a.pdf")],
      }),
    ).resolves.toBeUndefined();
    expect(update).not.toHaveBeenCalled();
  });

  it("si falla el insert de metadatos no sube nada ni lanza", async () => {
    process.env.EMAIL_ATTACHMENTS_BUCKET = "correo-adjuntos";
    const { admin, upload } = mockAdmin({ insertError: { message: "x" } });
    await expect(
      storeOutboundAttachments(admin, resendClient({ data: { data: [] } }), {
        messageId: MESSAGE_ID,
        resendEmailId: "re_1",
        files: [file("a.pdf")],
      }),
    ).resolves.toBeUndefined();
    expect(upload).not.toHaveBeenCalled();
  });

  it("empareja por nombre aunque haya ficheros repetidos", async () => {
    const { admin, insert } = mockAdmin();
    await storeOutboundAttachments(
      admin,
      resendClient({
        data: {
          data: [
            { id: "ra-1", filename: "a.pdf" },
            { id: "ra-2", filename: "a.pdf" },
          ],
        },
      }),
      { messageId: MESSAGE_ID, resendEmailId: "re_1", files: [file("a.pdf"), file("a.pdf")] },
    );
    const rows = insert.mock.calls[0][0] as { resend_attachment_id: string }[];
    expect(rows.map((r) => r.resend_attachment_id)).toEqual(["ra-1", "ra-2"]);
  });
});
