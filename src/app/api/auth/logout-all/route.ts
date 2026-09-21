import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  authSecretConfigured,
  sessionCookieOptions,
  verifySessionDetailed,
} from "@/lib/auth-session";
import { bumpSessionEpoch } from "@/lib/session-epoch-node";

export const dynamic = "force-dynamic";

/**
 * Botón de emergencia: invalida globalmente todas las sesiones
 * incrementando el session epoch compartido en Supabase.
 * Exige sesión válida. No se usa en el logout normal.
 */
export async function POST(request: Request) {
  try {
    if (!authSecretConfigured()) {
      return NextResponse.json(
        { ok: false, error: "Login no configurado en el servidor" },
        { status: 503 },
      );
    }
    const cookie = request.headers.get("cookie") ?? "";
    const token = cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
      ?.slice(SESSION_COOKIE.length + 1);
    const verified = token
      ? await verifySessionDetailed(decodeURIComponent(token))
      : { ok: false as const };
    if (!verified.ok) {
      return NextResponse.json(
        { ok: false, error: "No autorizado" },
        { status: 401 },
      );
    }
    const epoch = await bumpSessionEpoch();
    const response = NextResponse.json({ ok: true, epoch });
    response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo cerrar las sesiones" },
      { status: 503 },
    );
  }
}
