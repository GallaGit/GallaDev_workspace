import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAuthDisabled } from "@/lib/auth";
import { verifySession } from "@/lib/auth-session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ingesta pública del form (bearer propio en la ruta, sin sesión).
  if (pathname.startsWith("/api/ingest/")) {
    return NextResponse.next();
  }
  // Login/logout gestionan su propia lógica.
  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  if (isAuthDisabled()) {
    return NextResponse.next();
  }

  const token = request.cookies.get("lead_crm_session")?.value;
  if (token && (await verifySession(token))) {
    return NextResponse.next();
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("from", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
