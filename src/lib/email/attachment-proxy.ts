import "server-only";

import { isTrustedResendDownloadUrl } from "./attachment-download";
import { isPreviewableContentType } from "./attachment-meta";

/** Tipos activos que nunca se sirven inline (XSS en nuestro origen). */
const RISKY_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "text/xml",
  "application/xml",
  "text/javascript",
  "application/javascript",
]);

const INLINE_EXTRA = new Set(["text/plain"]);
const MAX_REDIRECTS = 3;

export function baseContentType(contentType: string): string {
  return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function isInlineContentType(contentType: string): boolean {
  const base = baseContentType(contentType);
  if (RISKY_TYPES.has(base)) return false;
  return isPreviewableContentType(base) || INLINE_EXTRA.has(base);
}

/** Content-Type seguro para la respuesta. Los tipos de riesgo pasan a octet-stream. */
export function safeResponseContentType(contentType: string): string {
  const base = baseContentType(contentType);
  if (!base || !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(base)) {
    return "application/octet-stream";
  }
  if (RISKY_TYPES.has(base)) return "application/octet-stream";
  if (base === "text/plain") return "text/plain; charset=utf-8";
  return base;
}

/** Content-Disposition con fallback ASCII + filename* RFC 5987. */
export function contentDisposition(
  filename: string,
  inline: boolean,
): string {
  const clean = (filename || "adjunto").replace(/[\x00-\x1f\x7f]/g, "").trim() || "adjunto";
  const ascii = clean
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/["\\%;]/g, "_")
    .trim() || "adjunto";
  const encoded = encodeURIComponent(clean).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export type UpstreamResult =
  | { ok: true; response: Response }
  | { ok: false; reason: "expired" | "resend-error" | "untrusted-url" };

/**
 * Descarga el fichero de Resend siguiendo redirecciones a mano y solo
 * hacia hosts de confianza (GDW-SEC-023).
 */
export async function fetchTrustedUpstream(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<UpstreamResult> {
  let current = url;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    if (!isTrustedResendDownloadUrl(current)) {
      return { ok: false, reason: "untrusted-url" };
    }
    let res: Response;
    try {
      res = await fetchImpl(current, { redirect: "manual", cache: "no-store" });
    } catch {
      return { ok: false, reason: "resend-error" };
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { ok: false, reason: "resend-error" };
      try {
        current = new URL(loc, current).toString();
      } catch {
        return { ok: false, reason: "untrusted-url" };
      }
      continue;
    }
    if (res.status === 403 || res.status === 404 || res.status === 410) {
      return { ok: false, reason: "expired" };
    }
    if (!res.ok || !res.body) return { ok: false, reason: "resend-error" };
    return { ok: true, response: res };
  }
  return { ok: false, reason: "resend-error" };
}
