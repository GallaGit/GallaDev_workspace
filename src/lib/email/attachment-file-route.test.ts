import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  resolveAttachmentContext,
  resolveAttachmentDownload,
} from "@/lib/email/attachment-download";
import { GET } from "@/app/api/email/attachments/[id]/file/route";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn(async () => null) }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));
vi.mock("@/lib/rate-limit", () => ({
  clientIp: () => "1.2.3.4",
  consumeRateLimit: vi.fn(async () => false),
}));
vi.mock("@/lib/email/attachment-download", async (orig) => ({
  ...(await orig<typeof import("@/lib/email/attachment-download")>()),
  resolveAttachmentDownload: vi.fn(),
  resolveAttachmentContext: vi.fn(async () => null),
}));

const storageDownload = vi.hoisted(() =>
  vi.fn<(path: string) => Promise<{ data: Blob | null; error: unknown }>>(
    async () => ({ data: null, error: null }),
  ),
);

const storageFrom = vi.hoisted(() =>
  vi.fn((bucket: string) => ({ bucket, download: storageDownload })),
);

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ storage: { from: storageFrom } }),
}));

const ID = "ed07cdd4-c542-4f9a-8b8e-bd73e358c6cd";
const call = (id = ID) =>
  GET(new Request(`http://localhost/api/email/attachments/${id}/file`), {
    params: Promise.resolve({ id }),
  });

function resolved(contentType: string, filename = "factura.pdf") {
  vi.mocked(resolveAttachmentDownload).mockResolvedValue({
    ok: true,
    downloadUrl: "https://cdn.resend.app/x?sig=1",
    expiresAt: "2026-10-14T13:00:00Z",
    filename,
    contentType,
    sizeBytes: 4,
  });
}

describe("GET /api/email/attachments/[id]/file", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(null);
    vi.stubEnv("EMAIL_ATTACHMENTS_BUCKET", undefined);
    vi.mocked(resolveAttachmentContext).mockResolvedValue(null);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("%PDF", { status: 200, headers: { "content-length": "4" } })),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("respeta requireAdmin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(
      NextResponse.json({ ok: false }, { status: 403 }) as never,
    );
    expect((await call()).status).toBe(403);
    expect(resolveAttachmentDownload).not.toHaveBeenCalled();
  });

  it("404 con id no UUID", async () => {
    expect((await call("nope")).status).toBe(404);
  });

  it("streaming inline para PDF con cabeceras seguras", async () => {
    resolved("application/pdf");
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toMatch(/^inline; filename="factura.pdf"/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.text()).toBe("%PDF");
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("fuerza attachment y octet-stream para HTML/SVG", async () => {
    resolved("image/svg+xml", "x.svg");
    const res = await call();
    expect(res.headers.get("content-disposition")).toMatch(/^attachment;/);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
  });

  it("attachment para tipos no previsualizables", async () => {
    resolved("application/zip", "a.zip");
    expect((await call()).headers.get("content-disposition")).toMatch(/^attachment;/);
  });

  it("410 si Resend ya no conserva el adjunto", async () => {
    vi.mocked(resolveAttachmentDownload).mockResolvedValue({ ok: false, reason: "expired" });
    const res = await call();
    expect(res.status).toBe(410);
    expect((await res.json()).reason).toBe("expired");
  });

  it("410 si la URL firmada caducó en el upstream", async () => {
    resolved("application/pdf");
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 403 }));
    expect((await call()).status).toBe(410);
  });

  it("502 si el upstream redirige a un host no confiable", async () => {
    resolved("application/pdf");
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 302, headers: { location: "https://evil.com/x" } }),
    );
    const res = await call();
    expect(res.status).toBe(502);
    expect((await res.json()).reason).toBe("untrusted-url");
  });

  it("sirve desde Storage cuando la fila tiene storage_path", async () => {
    vi.stubEnv("EMAIL_ATTACHMENTS_BUCKET", "adjuntos");
    vi.mocked(resolveAttachmentContext).mockResolvedValue({
      filename: "factura.pdf",
      contentType: "application/pdf",
      sizeBytes: 4,
      storagePath: `email/11111111-1111-4111-8111-111111111111/${ID}`,
      resendAttachmentId: "att-1",
      resendEmailId: "em_1",
      direction: "inbound",
    });
    storageDownload.mockResolvedValue({
      data: new Blob(["%PDF"], { type: "application/pdf" }),
      error: null,
    });
    vi.mocked(resolveAttachmentDownload).mockResolvedValue({
      ok: false,
      reason: "expired",
    });

    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toMatch(/^inline; filename="factura.pdf"/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("content-length")).toBe("4");
    expect(await res.text()).toBe("%PDF");
    expect(storageFrom).toHaveBeenCalledWith("adjuntos");
    expect(storageDownload).toHaveBeenCalledWith(
      `email/11111111-1111-4111-8111-111111111111/${ID}`,
    );
    expect(resolveAttachmentDownload).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("cae al proxy de Resend si Storage falla", async () => {
    vi.stubEnv("EMAIL_ATTACHMENTS_BUCKET", "adjuntos");
    vi.mocked(resolveAttachmentContext).mockResolvedValue({
      filename: "factura.pdf",
      contentType: "application/pdf",
      sizeBytes: 4,
      storagePath: `email/11111111-1111-4111-8111-111111111111/${ID}`,
      resendAttachmentId: "att-1",
      resendEmailId: "em_1",
      direction: "inbound",
    });
    storageDownload.mockResolvedValue({ data: null, error: { message: "missing" } });
    resolved("application/pdf");

    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("%PDF");
    expect(resolveAttachmentDownload).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("410 si fallan Storage y Resend", async () => {
    vi.stubEnv("EMAIL_ATTACHMENTS_BUCKET", "adjuntos");
    vi.mocked(resolveAttachmentContext).mockResolvedValue({
      filename: "factura.pdf",
      contentType: "application/pdf",
      sizeBytes: 4,
      storagePath: `email/11111111-1111-4111-8111-111111111111/${ID}`,
      resendAttachmentId: "att-1",
      resendEmailId: "em_1",
      direction: "inbound",
    });
    storageDownload.mockResolvedValue({ data: null, error: { message: "missing" } });
    vi.mocked(resolveAttachmentDownload).mockResolvedValue({
      ok: false,
      reason: "expired",
    });

    const res = await call();
    expect(res.status).toBe(410);
    expect((await res.json()).reason).toBe("expired");
  });
  it("ignora una ruta de Storage no opaca y cae a Resend", async () => {
    vi.stubEnv("EMAIL_ATTACHMENTS_BUCKET", "adjuntos");
    vi.mocked(resolveAttachmentContext).mockResolvedValue({
      filename: "factura.pdf",
      contentType: "application/pdf",
      sizeBytes: 4,
      storagePath: "../otros/secreto.pdf",
      resendAttachmentId: "att-1",
      resendEmailId: "em_1",
      direction: "inbound",
    });
    resolved("application/pdf");

    const res = await call();
    expect(res.status).toBe(200);
    expect(storageDownload).not.toHaveBeenCalled();
    expect(resolveAttachmentDownload).toHaveBeenCalled();
  });
});
