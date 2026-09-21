import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAuthDisabled } from "@/lib/auth";
import {
  SESSION_COOKIE,
  issueSession,
  sessionCookieOptions,
  sessionNeedsRefresh,
  sessionTtlMs,
  verifySessionDetailed,
} from "@/lib/auth-session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ingesta pública del form (bearer propio en la ruta, sin sesión).
  if (pathname.startsWith("/api/ingest/")) {
    return NextResponse.next();
  }
  // Login/logout de un solo dispositivo gestionan su propia lógica.
  // logout-all queda protegido: exige sesión válida (botón de emergencia).
  if (
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout" ||
    pathname.startsWith("/login")
  ) {
    return NextResponse.next();
  }

  if (isAuthDisabled()) {
    return NextResponse.next();
  }

  const now = Date.now();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    const verified = await verifySessionDetailed(token, now);
    if (verified.ok) {
      const res = NextResponse.next();
      if (sessionNeedsRefresh(verified.exp, now)) {
        const refreshed = await issueSession(now);
        if (refreshed) {
          const ttl = sessionTtlMs();
          res.cookies.set(
            SESSION_COOKIE,
            refreshed,
            sessionCookieOptions(Math.floor(ttl / 1000)),
          );
        }
      }
      return res;
    }
  }

  // APIs: 401 JSON. Páginas: redirect a /login.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 401 },
    );
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("from", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
