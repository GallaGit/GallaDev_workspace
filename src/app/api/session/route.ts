import { NextResponse } from "next/server";
import { getApiSession, requireApiSession } from "@/lib/api-auth";
import { isVisitorRequest } from "@/lib/demo/visitor-request";

export const dynamic = "force-dynamic";

/**
 * GET /api/session — rol del usuario actual para la UI.
 * No lista a otros miembros. Con AUTH_DISABLED devuelve el Admin local.
 * Un visitante no tiene rol Admin/Seller/Viewer.
 */
export async function GET() {
  if (await isVisitorRequest()) {
    return NextResponse.json({
      id: "visitor",
      email: null,
      role: null,
      visitor: true,
    });
  }
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
