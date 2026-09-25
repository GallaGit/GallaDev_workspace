import { NextResponse } from "next/server";
import { visitorCookieOptions } from "@/lib/demo/cookie";
import {
  VISITOR_COOKIE,
  demoSessionSecret,
  isDemoConfigured,
  isDemoModeEnabled,
} from "@/lib/demo/config";
import { signVisitorToken } from "@/lib/demo/token";
import { clientIp, isRateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 8;

/**
 * Abre una sesión de visitante. No crea usuario ni toca Supabase.
 * Apagado si DEMO_MODE_ENABLED no está a true/1.
 */
export async function POST(request: Request) {
  if (!isDemoModeEnabled()) {
    return NextResponse.json(
      { ok: false, error: "La demo no está disponible.", code: "demo_disabled" },
      { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow" } },
    );
  }
  if (!isDemoConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "La demo no está configurada.",
        code: "demo_misconfigured",
      },
      { status: 503, headers: { "X-Robots-Tag": "noindex, nofollow" } },
    );
  }
  if (
    isRateLimited("demo-enter", clientIp(request), {
      windowMs: WINDOW_MS,
      max: MAX_PER_WINDOW,
    })
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Demasiados intentos para entrar en la demo. Prueba más tarde.",
        code: "rate_limited",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(WINDOW_MS / 1000)),
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
    );
  }

  const secret = demoSessionSecret();
  if (!secret) {
    return NextResponse.json(
      {
        ok: false,
        error: "La demo no está configurada.",
        code: "demo_misconfigured",
      },
      { status: 503 },
    );
  }

  const signed = signVisitorToken(secret);
  const response = NextResponse.json(
    { ok: true },
    {
      headers: {
        "X-Robots-Tag": "noindex, nofollow",
        "Cache-Control": "private, no-store",
      },
    },
  );
  response.cookies.set(VISITOR_COOKIE, signed.token, visitorCookieOptions(signed.maxAge));
  return response;
}
