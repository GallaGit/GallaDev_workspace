import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { resolveAttachmentDownload } from "@/lib/email/attachment-download";
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
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("%PDF", { status: 200, headers: { "content-length": "4" } })),
    );
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
});
