import { NextResponse } from "next/server";
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
const hits = new Map<string, number[]>();

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

export async function POST(request: Request) {
  if (!authSecretConfigured() || !authPasswordConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Login no configurado en el servidor" },
      { status: 503 },
    );
  }

  const ip = clientIp(request);
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos. Espera un minuto." },
      { status: 429 },
    );
  }
  recent.push(now);
  hits.set(ip, recent);

  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json(
      { ok: false, error: "Solicitud no válida" },
      { status: 400 },
    );
  }

  if (!(await passwordOk(password))) {
    return NextResponse.json(
      { ok: false, error: "Contraseña incorrecta" },
      { status: 401 },
    );
  }

  const token = await issueSession(now);
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
