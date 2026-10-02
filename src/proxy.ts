import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAppRole, isAuthDisabled } from "@/lib/auth";
import { buildContentSecurityPolicy } from "@/lib/security/csp";
import { VISITOR_COOKIE, demoSessionSecret, isDemoConfigured } from "@/lib/demo/config";
import {
  isVisitorBlockedApi,
  isVisitorBlockedPage,
  visitorDeniedResponse,
} from "@/lib/demo/gate";
import { verifyVisitorToken } from "@/lib/demo/token";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Puerta de autenticación (Paso 2 — Supabase Auth multiusuario).
 *
 * Convención `proxy` vigente en Next 16 (`middleware` está deprecado).
 * Con auth desactivado (dev local) deja pasar todo. En caso contrario
 * exige sesión Supabase: APIs sin usuario → 401 JSON, páginas → /login.
 * Un usuario autenticado sin rol de app va a /pending (las APIs reciben
 * 401 no_profile). La ingesta pública (/api/ingest/*, bearer propio) y el
 * liveness `/api/health` quedan exentos. El matcher también omite
 * `api/health` para no exigir Supabase en el probe.
 *
 * Cada respuesta lleva una CSP con nonce. Next.js lee ese nonce del
 * header de la petición y lo aplica a sus scripts. Hace falta render
 * dinámico (el layout lee `x-nonce`).
 */
const NO_PROFILE = {
  ok: false as const,
  error:
    "Tu usuario está autenticado pero no tiene un perfil asignado. Contacta al administrador.",
  code: "no_profile" as const,
};

function visitorAllowed(request: NextRequest): boolean {
  if (!isDemoConfigured()) return false;
  const secret = demoSessionSecret();
  if (!secret) return false;
  return verifyVisitorToken(request.cookies.get(VISITOR_COOKIE)?.value, secret);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildContentSecurityPolicy(nonce);

  const forward = (decorate?: (response: NextResponse) => void) => {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set("Content-Security-Policy", csp);
    decorate?.(response);
    return response;
  };

  const stamp = (outgoing: NextResponse) => {
    outgoing.headers.set("Content-Security-Policy", csp);
    return outgoing;
  };

  if (pathname === "/api/health" || pathname.startsWith("/api/health/")) {
    return forward();
  }
  // Entrar y salir de la demo no exige sesión Supabase.
  if (pathname === "/api/demo/enter" || pathname === "/api/demo/exit") {
    return forward();
  }

  if (visitorAllowed(request)) {
    if (isVisitorBlockedApi(pathname, request.method)) {
      return stamp(visitorDeniedResponse());
    }
    if (isVisitorBlockedPage(pathname)) {
      return stamp(NextResponse.redirect(new URL("/leads", request.url)));
    }
    // Cookie válida: solo la lista blanca de la demo, sin cliente de Supabase.
    return forward((response) => {
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
      response.headers.set("Cache-Control", "private, no-store");
    });
  }

  if (pathname.startsWith("/api/ingest/")) {
    return forward();
  }
  // Webhook de Resend inbound: auth por firma Svix, no por sesión.
  if (pathname === "/api/email/inbound") {
    return forward();
  }
  if (pathname.startsWith("/login")) {
    return forward();
  }
  if (isAuthDisabled()) {
    return forward();
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
  if (!url || !key) return stamp(unauthorized());

  let response = forward();
  let sessionCookies: {
    name: string;
    value: string;
    options?: Parameters<NextResponse["cookies"]["set"]>[2];
  }[] = [];
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        sessionCookies = cookiesToSet;
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = forward();
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const finish = (outgoing: NextResponse) => {
    outgoing.headers.set("Content-Security-Policy", csp);
    for (const { name, value, options } of sessionCookies) {
      outgoing.cookies.set(name, value, options);
    }
    return outgoing;
  };

  if (!user) return finish(unauthorized());

  if (pathname === "/pending") return response;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!isAppRole(profile?.role)) {
    if (pathname.startsWith("/api/")) {
      return finish(NextResponse.json(NO_PROFILE, { status: 401 }));
    }
    return finish(NextResponse.redirect(new URL("/pending", request.url)));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
