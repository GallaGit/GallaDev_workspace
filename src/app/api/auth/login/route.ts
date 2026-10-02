import { NextResponse } from "next/server";
import {
  LOGIN_ACCOUNT_NAMESPACE,
  LOGIN_CONFIG_ERROR,
  LOGIN_GENERIC_ERROR,
  LOGIN_IP_NAMESPACE,
  LOGIN_MAX_PER_ACCOUNT,
  LOGIN_MAX_PER_IP,
  LOGIN_NETWORK_ERROR,
  LOGIN_RATE_ERROR,
  LOGIN_WINDOW_MS,
} from "@/lib/auth/login-limit";
import { visitorCookieOptions } from "@/lib/demo/cookie";
import { VISITOR_COOKIE } from "@/lib/demo/config";
import { clientIp, consumeRateLimit, readCappedJson } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BODY_MAX_BYTES = 8 * 1024;
const EMAIL_KEY_MAX = 320;

function json(
  status: number,
  error: string,
  code?: "rate_limited" | "config" | "network",
) {
  return NextResponse.json(
    { ok: false, error, ...(code ? { code } : {}) },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        ...(code === "rate_limited"
          ? { "Retry-After": String(Math.ceil(LOGIN_WINDOW_MS / 1000)) }
          : {}),
      },
    },
  );
}

/**
 * Login de la app. El navegador no llama a Auth directamente.
 * Cupo por IP de plataforma y por cuenta. El fallo de Auth siempre
 * responde el mismo texto (no distingue correo sin confirmar).
 */
export async function POST(request: Request) {
  const read = await readCappedJson(request, BODY_MAX_BYTES);
  const body = read.ok && read.value && typeof read.value === "object"
    ? (read.value as Record<string, unknown>)
    : null;
  const rawEmail =
    body && typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const email = rawEmail.slice(0, EMAIL_KEY_MAX);
  const password = body && typeof body.password === "string" ? body.password : "";

  const ipLimited = await consumeRateLimit(LOGIN_IP_NAMESPACE, clientIp(request), {
    windowMs: LOGIN_WINDOW_MS,
    max: LOGIN_MAX_PER_IP,
  });
  const accountLimited = await consumeRateLimit(
    LOGIN_ACCOUNT_NAMESPACE,
    email || "blank",
    { windowMs: LOGIN_WINDOW_MS, max: LOGIN_MAX_PER_ACCOUNT },
  );
  if (ipLimited || accountLimited) {
    return json(429, LOGIN_RATE_ERROR, "rate_limited");
  }

  if (
    !read.ok ||
    !rawEmail ||
    rawEmail.length > EMAIL_KEY_MAX ||
    !password ||
    password.length > 1024
  ) {
    return json(401, LOGIN_GENERIC_ERROR);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: rawEmail,
      password,
    });
    if (error) return json(401, LOGIN_GENERIC_ERROR);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message.includes("no configurados")) {
      return json(503, LOGIN_CONFIG_ERROR, "config");
    }
    return json(503, LOGIN_NETWORK_ERROR, "network");
  }

  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
  response.cookies.set(VISITOR_COOKIE, "", visitorCookieOptions(0));
  return response;
}
