import { NextResponse } from "next/server";

/**
 * Respuesta única para un visitante que pide algo que la demo no hace.
 * 403, no 401: hay sesión de demo, pero no permiso sobre datos reales.
 */
export const VISITOR_DENIED_BODY = {
  ok: false as const,
  error:
    "En la demo no se puede hacer eso. Los datos son ficticios y de solo lectura.",
  code: "demo_readonly" as const,
};

export function visitorDeniedResponse(): NextResponse {
  return NextResponse.json(VISITOR_DENIED_BODY, {
    status: 403,
    headers: {
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "private, no-store",
    },
  });
}

const BLOCKED_API_PREFIXES = [
  "/api/team",
  "/api/settings",
  "/api/automations",
  "/api/db-status",
  "/api/ingest",
  "/api/leads/score",
  "/api/leads/merge",
  "/api/leads/pain-analysis",
];

const BLOCKED_PAGES = ["/settings", "/automations", "/email"];

/** APIs que un visitante no debe ejecutar (ni leer configuración). */
export function isVisitorBlockedApi(pathname: string, method: string): boolean {
  if (
    BLOCKED_API_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return true;
  }
  if (/^\/api\/leads\/[^/]+\/analyze\/?$/.test(pathname)) return true;
  const leadWrite =
    pathname === "/api/leads" || /^\/api\/leads\/[^/]+\/?$/.test(pathname);
  if (leadWrite && method !== "GET" && method !== "HEAD") return true;
  return false;
}

/** Páginas de ajustes, automatizaciones y correo: fuera de la demo. */
export function isVisitorBlockedPage(pathname: string): boolean {
  return BLOCKED_PAGES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
