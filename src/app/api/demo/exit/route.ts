import { NextResponse } from "next/server";
import { visitorCookieOptions } from "@/lib/demo/cookie";
import { VISITOR_COOKIE } from "@/lib/demo/config";

export const dynamic = "force-dynamic";

/** Borra la cookie de visitante. No toca la sesión de Supabase. */
export async function POST() {
  const response = NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
  response.cookies.set(VISITOR_COOKIE, "", visitorCookieOptions(0));
  return response;
}
