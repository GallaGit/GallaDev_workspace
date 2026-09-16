import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAuthDisabled } from "@/lib/auth";

export function middleware(request: NextRequest) {
  // Ingesta pública del form (bearer propio en la ruta, sin sesión).
  if (request.nextUrl.pathname.startsWith("/api/ingest/")) {
    return NextResponse.next();
  }

  if (isAuthDisabled()) {
    return NextResponse.next();
  }

  const session = request.cookies.get("lead_crm_session")?.value;
  if (!session && !request.nextUrl.pathname.startsWith("/login")) {
    const login = new URL("/login", request.url);
    login.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
