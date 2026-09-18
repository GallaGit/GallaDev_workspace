import { NextResponse } from "next/server";
import {
  corsHeaders,
  getIntakeSettings,
  resolveIntakeStatus,
  withCors,
} from "@/lib/intake";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/public/intake — estado de captación para galladev.com (sin auth).
 * Respuesta: `{ open: true }` | `{ open: false, message, reopensAt }`.
 * Auto-abre si reopensAt ya pasó (lazy persist en getIntakeSettings).
 */
export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

export async function GET(request: Request) {
  try {
    const settings = await getIntakeSettings();
    const status = resolveIntakeStatus(settings);
    return withCors(
      request,
      NextResponse.json(status, {
        headers: {
          "Cache-Control": "no-store",
        },
      }),
    );
  } catch (e) {
    console.error("[public/intake]", e);
    // Fail-open: no bloquear la landing si Supabase falla.
    return withCors(
      request,
      NextResponse.json({ open: true }, { status: 200 }),
    );
  }
}
