import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth-session";
import { bumpSessionEpoch } from "@/lib/session-epoch-node";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
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
