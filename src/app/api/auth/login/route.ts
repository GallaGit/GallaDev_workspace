import { NextResponse } from "next/server";
import {
  clientIp,
  isRateLimited,
  readCappedJson,
} from "@/lib/rate-limit";
import {
  authPasswordConfigured,
  authSecretConfigured,
  issueSession,
  passwordOk,
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionTtlMs,
} from "@/lib/auth-session";

export const dynamic = "force-dynamic";

// Anti-fuerza bruta best-effort (por instancia).
const WINDOW_MS = 60 * 1000;
const MAX = 10;
const MAX_BODY_BYTES = 32 * 1024;

export async function POST(request: Request) {
  if (!authSecretConfigured() || !authPasswordConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Login no configurado en el servidor" },
      { status: 503 },
    );
  }

  if (
    isRateLimited("auth:login", clientIp(request), {
      windowMs: WINDOW_MS,
      max: MAX,
    })
  ) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos. Espera un minuto." },
      { status: 429 },
    );
  }

  const parsed = await readCappedJson(request, MAX_BODY_BYTES);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: "Solicitud no válida" },
      { status: 400 },
    );
  }
  const body = parsed.value as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";

  if (!(await passwordOk(password))) {
    return NextResponse.json(
      { ok: false, error: "Contraseña incorrecta" },
      { status: 401 },
    );
  }

  const token = await issueSession();
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Servicio de sesión no disponible" },
      { status: 503 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(
    SESSION_COOKIE,
    token,
    sessionCookieOptions(Math.floor(sessionTtlMs() / 1000)),
  );
  return res;
}
