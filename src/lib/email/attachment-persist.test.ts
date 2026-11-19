import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getReceivingAtt = vi.hoisted(() => vi.fn());
const getResendClient = vi.hoisted(() => vi.fn());

vi.mock("./resend-client", () => ({ getResendClient }));

import {
  attachmentStoragePath,
  attachmentsBucket,
  canPersistAttachment,
  isPersistedStoragePath,
  persistInboundAttachments,
} from "./attachment-persist";
import { MAX_ATTACHMENT_BYTES } from "./limits";

const MESSAGE_ID = "11111111-2222-4333-8444-555555555555";
const ATTACHMENT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const SIGNED_URL = "https://inbound-cdn.resend.com/x?sig=1";

const ROW = {
  message_id: MESSAGE_ID,
  resend_attachment_id: "att-1",
  filename: "secreto-factura.pdf",
  content_type: "application/pdf",
  size_bytes: 4,
};

function mockAdmin(opts: {
  inserted?: Record<string, unknown>[] | null;
  insertError?: { message: string } | null;
  uploadError?: { message: string } | null;
  updateError?: { message: string } | null;
} = {}) {
  const inserted =
    opts.inserted === undefined ? [{ ...ROW, id: ATTACHMENT_ID }] : opts.inserted;
  const insertSelect = vi.fn().mockResolvedValue({
    data: inserted,
    error: opts.insertError ?? null,
  });
  const insert = vi.fn().mockReturnValue({
    error: null,
    select: insertSelect,
  });
  const updateEq = vi.fn().mockResolvedValue({ error: opts.updateError ?? null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const upload = vi.fn().mockResolvedValue({ error: opts.uploadError ?? null });
  const from = vi.fn((table: string) =>
    table === "email_attachments" ? { insert, update } : {},
  );
  const storageFrom = vi.fn((bucket: string) => ({ bucket, upload }));
  const admin = { from, storage: { from: storageFrom } };
  return { admin, insert, insertSelect, update, updateEq, upload, storageFrom };
}

function signedDownload(headers?: HeadersInit) {
  getReceivingAtt.mockResolvedValue({
    data: { id: "att-1", download_url: SIGNED_URL },
    error: null,
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("%PDF", { status: 200, headers })),
  );
}

describe("attachment-persist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("EMAIL_ATTACHMENTS_BUCKET", "adjuntos");
    getResendClient.mockReturnValue({
      emails: { receiving: { attachments: { get: getReceivingAtt } } },
    });
    signedDownload();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("respeta el tope de 50 MiB solo con tamaño conocido", () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(52_428_800);
    expect(canPersistAttachment(MAX_ATTACHMENT_BYTES)).toBe(true);
    expect(canPersistAttachment(MAX_ATTACHMENT_BYTES + 1)).toBe(false);
    expect(canPersistAttachment(null)).toBe(true);
    expect(canPersistAttachment(undefined)).toBe(true);
    expect(canPersistAttachment(-1)).toBe(false);
    expect(canPersistAttachment(Number.NaN)).toBe(false);
  });

  it("construye rutas opacas solo con UUIDs", () => {
    expect(attachmentStoragePath(MESSAGE_ID, ATTACHMENT_ID)).toBe(
      `email/${MESSAGE_ID}/${ATTACHMENT_ID}`,
    );
    expect(attachmentStoragePath(MESSAGE_ID, "factura.pdf")).toBeNull();
    expect(attachmentStoragePath("not-a-uuid", ATTACHMENT_ID)).toBeNull();
  });


  it("acepta solo rutas opacas email/{uuid}/{uuid}", () => {
    const msg = "11111111-1111-4111-8111-111111111111";
    const att = "22222222-2222-4222-8222-222222222222";
    expect(isPersistedStoragePath(attachmentStoragePath(msg, att)!)).toBe(true);
    expect(isPersistedStoragePath("email/not-a-uuid/also-not")).toBe(false);
    expect(isPersistedStoragePath("../secret")).toBe(false);
    expect(isPersistedStoragePath("email/" + msg)).toBe(false);
    expect(isPersistedStoragePath("")).toBe(false);
  });

  it("sin bucket configurado solo inserta metadatos", async () => {
    vi.stubEnv("EMAIL_ATTACHMENTS_BUCKET", "   ");
    expect(attachmentsBucket()).toBeNull();
    const { admin, insert, insertSelect, storageFrom } = mockAdmin();

    await persistInboundAttachments(admin as never, "em_1", [ROW]);

    expect(insert).toHaveBeenCalledWith([ROW]);
    expect(insertSelect).not.toHaveBeenCalled();
    expect(storageFrom).not.toHaveBeenCalled();
    expect(getResendClient).not.toHaveBeenCalled();
  });

  it("descarga, sube y guarda storage_path tras el insert", async () => {
    const { admin, insertSelect, upload, storageFrom, update, updateEq } =
      mockAdmin();

    await persistInboundAttachments(admin as never, "em_1", [ROW]);

    expect(insertSelect).toHaveBeenCalledWith(
      "id, message_id, resend_attachment_id, filename, content_type, size_bytes",
    );
    expect(getReceivingAtt).toHaveBeenCalledWith({ emailId: "em_1", id: "att-1" });
    const path = `email/${MESSAGE_ID}/${ATTACHMENT_ID}`;
    expect(storageFrom).toHaveBeenCalledWith("adjuntos");
    expect(upload).toHaveBeenCalledWith(
      path,
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: "application/pdf", upsert: false }),
    );
    expect(update).toHaveBeenCalledWith({ storage_path: path });
    expect(updateEq).toHaveBeenCalledWith("id", ATTACHMENT_ID);
  });

  it("no descarga un adjunto mayor al tope", async () => {
    const big = { ...ROW, size_bytes: MAX_ATTACHMENT_BYTES + 1 };
    const { admin, upload, update } = mockAdmin({
      inserted: [{ ...big, id: ATTACHMENT_ID }],
    });

    await persistInboundAttachments(admin as never, "em_1", [big]);

    expect(getReceivingAtt).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("no sube un cuerpo que supera el tope aunque el tamaño se desconozca", async () => {
    const { admin, upload, update } = mockAdmin({
      inserted: [{ ...ROW, id: ATTACHMENT_ID, size_bytes: null }],
    });
    signedDownload({
      "content-length": String(MAX_ATTACHMENT_BYTES + 1),
    });

    await persistInboundAttachments(admin as never, "em_1", [
      { ...ROW, size_bytes: null },
    ]);

    expect(upload).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("un fallo de subida no lanza y conserva los metadatos", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { admin, upload, update } = mockAdmin({
      uploadError: { message: "storage lleno" },
    });

    await expect(
      persistInboundAttachments(admin as never, "em_1", [ROW]),
    ).resolves.toBeUndefined();

    expect(upload).toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("un error inesperado del admin tampoco se propaga", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { admin } = mockAdmin();
    vi.mocked(admin.from).mockImplementation(() => {
      throw new Error("boom");
    });

    await expect(
      persistInboundAttachments(admin as never, "em_1", [ROW]),
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
