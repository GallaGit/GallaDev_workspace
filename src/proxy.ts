import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAuthDisabled } from "@/lib/auth";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Puerta de autenticación (Paso 2 — Supabase Auth multiusuario).
 *
 * Convención `proxy` vigente en Next 16 (`middleware` está deprecado).
 * Con auth desactivado (dev local) deja pasar todo. En caso contrario
 * exige sesión Supabase: APIs sin usuario → 401 JSON, páginas → /login.
 * La ingesta pública (/api/ingest/*, bearer propio) y el liveness
 * `/api/health` quedan exentos. El matcher también omite `api/health`
 * para no exigir Supabase en el probe.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/api/health" || pathname.startsWith("/api/health/")) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/ingest/")) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/login")) {
    return NextResponse.next();
  }
  if (isAuthDisabled()) {
    return NextResponse.next();
  }

  const unauthorized = () => {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: "No autorizado" },
        { status: 401 },
      );
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  };

  const url = supabaseUrl();
  const key = supabasePublishableKey();
  if (!url || !key) return unauthorized();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return response;
  return unauthorized();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
