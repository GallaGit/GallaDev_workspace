import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness only: the Node process can answer HTTP.
 * No auth, no database, no env values. Connectivity lives on GET /api/db-status.
 * `src/proxy.ts` excludes this path from the session gate.
 */
export function GET() {
  return NextResponse.json(
    { ok: true },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
