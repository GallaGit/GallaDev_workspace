import { describe, expect, it, vi } from "vitest";
import {
  contentDisposition,
  fetchTrustedUpstream,
  isInlineContentType,
  safeResponseContentType,
} from "./attachment-proxy";

describe("attachment-proxy helpers", () => {
  it.each([
    ["application/pdf", true],
    ["image/png", true],
    ["text/plain; charset=utf-8", true],
    ["text/html", false],
    ["image/svg+xml", false],
    ["application/zip", false],
  ])("isInlineContentType(%s) = %s", (ct, v) => expect(isInlineContentType(ct)).toBe(v));

  it("neutraliza tipos de riesgo y valores inválidos", () => {
    expect(safeResponseContentType("text/html")).toBe("application/octet-stream");
    expect(safeResponseContentType("image/svg+xml")).toBe("application/octet-stream");
    expect(safeResponseContentType("bad\r\nX: y")).toBe("application/octet-stream");
    expect(safeResponseContentType("application/PDF")).toBe("application/pdf");
  });

  it("Content-Disposition RFC 5987 sin inyección de cabeceras", () => {
    const v = contentDisposition('fa"ctu\r\nra ñ (1).pdf', true);
    expect(v).toMatch(/^inline; filename="/);
    expect(v).not.toMatch(/[\r\n]/);
    expect(v).toContain("filename*=UTF-8''fa%22ctura%20%C3%B1%20%281%29.pdf");
    expect(contentDisposition("", false)).toBe(
      `attachment; filename="adjunto"; filename*=UTF-8''adjunto`,
    );
  });
});

describe("fetchTrustedUpstream", () => {
  const ok = () => new Response("data", { status: 200 });

  it("rechaza URL no confiable sin hacer fetch", async () => {
    const f = vi.fn();
    expect(await fetchTrustedUpstream("https://evil.com/x", f)).toEqual({
      ok: false,
      reason: "untrusted-url",
    });
    expect(f).not.toHaveBeenCalled();
  });

  it("sigue redirecciones solo a hosts Resend y usa redirect manual", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "https://cdn.resend.app/b" } }),
      )
      .mockResolvedValueOnce(ok());
    const r = await fetchTrustedUpstream("https://cdn.resend.app/a", f);
    expect(r.ok).toBe(true);
    expect(f.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("bloquea redirección a host no confiable", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "https://evil.com/b" } }),
      );
    expect(await fetchTrustedUpstream("https://cdn.resend.app/a", f)).toEqual({
      ok: false,
      reason: "untrusted-url",
    });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it.each([403, 404, 410])("upstream %s → expired", async (s) => {
    const f = vi.fn().mockResolvedValue(new Response(null, { status: s }));
    expect(await fetchTrustedUpstream("https://cdn.resend.app/a", f)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("500 o error de red → resend-error", async () => {
    expect(
      await fetchTrustedUpstream("https://cdn.resend.app/a", vi.fn().mockResolvedValue(new Response("x", { status: 500 }))),
    ).toEqual({ ok: false, reason: "resend-error" });
    expect(
      await fetchTrustedUpstream("https://cdn.resend.app/a", vi.fn().mockRejectedValue(new Error("x"))),
    ).toEqual({ ok: false, reason: "resend-error" });
  });
});
