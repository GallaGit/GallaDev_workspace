import { NextResponse } from "next/server";
import { isAuthDisabled } from "@/lib/auth";
import { SESSION_COOKIE, verifySessionDetailed } from "@/lib/auth-session";

/**
 * Defensa en profundidad para route handlers (M1 — GEM_ROADMAP 1.1).
 *
 * El middleware ya protege páginas y APIs cuando el auth está activo,
 * pero cada ruta sensible verifica la sesión de forma explícita para no
 * depender de una sola capa (un matcher mal configurado no debe abrir datos).
 *
 * Devuelve `null` si la petición está autorizada (auth local desactivado
 * o cookie de sesión válida) o una respuesta 401 JSON si no lo está.
 */
export async function requireApiSession(
  request: Request,
): Promise<NextResponse | null> {
  if (isAuthDisabled()) return null;
  const token = getCookieValue(
    request.headers.get("cookie"),
    SESSION_COOKIE,
  );
  if (token && (await verifySessionDetailed(token)).ok) return null;
  return NextResponse.json(
    { ok: false, error: "No autorizado" },
    { status: 401 },
  );
}

/** Lee una cookie de la cabecera `Cookie` sin dependencias. */
export function getCookieValue(
  cookieHeader: string | null,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    if (part.slice(0, eq).trim() === name) {
      const value = part.slice(eq + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
}
