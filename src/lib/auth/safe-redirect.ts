/**
 * Destino post-login. Solo rutas de esta app.
 * Rechaza esquema, protocolo-relativo (`//host`), barra invertida y otro origen.
 */

const APP_ORIGIN = "https://workspace.galladev.com";

const PREFIXES = [
  "/leads",
  "/inbox",
  "/kanban",
  "/stats",
  "/duplicates",
  "/settings",
  "/automations",
  "/email",
  "/correo",
  "/login",
  "/pending",
];

function allowedPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function safeAppPath(from: string | null | undefined): string {
  if (!from) return "/";
  const trimmed = from.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    trimmed.includes("://") ||
    trimmed.includes("\0")
  ) {
    return "/";
  }

  let url: URL;
  try {
    url = new URL(trimmed, APP_ORIGIN);
  } catch {
    return "/";
  }
  if (url.origin !== APP_ORIGIN) return "/";
  if (url.username || url.password) return "/";
  const pathname = url.pathname;
  if (
    !pathname.startsWith("/") ||
    pathname.startsWith("//") ||
    pathname.includes("\\") ||
    pathname.includes("\0")
  ) {
    return "/";
  }
  if (!allowedPath(pathname)) return "/";
  return `${pathname}${url.search}${url.hash}`;
}
