import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth-session";
import { bumpSessionEpoch } from "@/lib/session-epoch";

export const dynamic = "force-dynamic";

/** Invalida todas las sesiones (bump de epoch) y limpia la cookie actual. */
export async function POST() {
  const sv = bumpSessionEpoch();
  const res = NextResponse.json({ ok: true, sv });
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return res;
}
