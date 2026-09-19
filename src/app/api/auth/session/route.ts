import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAuthDisabled } from "@/lib/auth";
import {
  SESSION_COOKIE,
  sessionNeedsWarning,
  sessionTtlMs,
  verifySessionDetailed,
} from "@/lib/auth-session";

export const dynamic = "force-dynamic";

/**
 * Estado de la sesión actual para la UI (aviso de caducidad).
 * Sin auth / sin cookie → authenticated false.
 */
export async function GET() {
  if (isAuthDisabled()) {
    return NextResponse.json({
      authenticated: false,
      authDisabled: true,
    });
  }

  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ authenticated: false, authDisabled: false });
  }

  const now = Date.now();
  const verified = await verifySessionDetailed(token, now);
  if (!verified.ok) {
    return NextResponse.json({ authenticated: false, authDisabled: false });
  }

  const ttlMs = sessionTtlMs();
  const remainingMs = Math.max(0, verified.exp - now);
  return NextResponse.json({
    authenticated: true,
    authDisabled: false,
    exp: verified.exp,
    ttlMs,
    remainingMs,
    needsWarning: sessionNeedsWarning(verified.exp, now),
    sv: verified.sv,
  });
}
