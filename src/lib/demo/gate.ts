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

const VISITOR_PAGES = [
  "/leads",
  "/kanban",
  "/stats",
  "/inbox",
  "/duplicates",
  "/login",
];

const RESERVED_LEAD_SEGMENTS = new Set(["score", "merge", "pain-analysis", "duplicates"]);

function stripTrailingSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function isRead(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

/**
 * Lista blanca. Una ruta nueva no entra en la demo hasta añadirla aquí.
 * El repositorio ficticio sigue siendo la segunda capa en las rutas de leads.
 */
export function isVisitorAllowedApi(pathname: string, method: string): boolean {
  const path = stripTrailingSlash(pathname);
  if (
    isRead(method) &&
    (path === "/api/session" || path === "/api/leads" || path === "/api/leads/duplicates")
  ) {
    return true;
  }
  const lead = /^\/api\/leads\/([^/]+)$/.exec(path);
  if (lead && isRead(method) && !RESERVED_LEAD_SEGMENTS.has(lead[1] ?? "")) {
    return true;
  }
  return method === "POST" && path === "/api/sync";
}

export function isVisitorAllowedPage(pathname: string): boolean {
  const path = stripTrailingSlash(pathname);
  if (path === "/") return true;
  return VISITOR_PAGES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** true cuando una API no está en la lista blanca. Las páginas no cuentan. */
export function isVisitorBlockedApi(pathname: string, method: string): boolean {
  if (!stripTrailingSlash(pathname).startsWith("/api/")) return false;
  return !isVisitorAllowedApi(pathname, method);
}

/** Páginas fuera de la demo: el proxy redirige a /leads. Las APIs no cuentan. */
export function isVisitorBlockedPage(pathname: string): boolean {
  if (stripTrailingSlash(pathname).startsWith("/api/")) return false;
  return !isVisitorAllowedPage(pathname);
}
