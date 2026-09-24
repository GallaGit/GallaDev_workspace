import { NextResponse } from "next/server";
import { getApiSession, requireApiSession } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/session — rol del usuario actual para la UI.
 * No lista a otros miembros. Con AUTH_DISABLED devuelve el Admin local.
 */
export async function GET() {
  const denied = await requireApiSession();
  if (denied) return denied;
  const user = await getApiSession();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "No autorizado", code: "unauthenticated" },
      { status: 401 },
    );
  }
  return NextResponse.json({
    id: user.id,
    email: user.email,
    role: user.role,
  });
}
