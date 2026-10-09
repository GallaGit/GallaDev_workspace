import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { withJsonErrors } from "@/lib/api-handler";
import { backfillMissingBodies } from "@/lib/email/backfill-bodies";
import { logRouteError, errorClassOf, requestIdFrom } from "@/lib/route-log";
import { clientIp, consumeRateLimit, readCappedJson } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 3;
const BODY_MAX_BYTES = 4 * 1024;

/**
 * POST /api/email/backfill-bodies — rellena cuerpos inbound vacíos desde Resend.
 * Body opcional: { limit?: number } (1–500, default 100).
 * Auth: requireAdmin. Idempotente.
 *
 * Ejecutar una vez tras rotar RESEND_API_KEY a full access, antes de que
 * Resend borre los recibidos (~30 días).
 */
async function postBackfill(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const requestId = requestIdFrom(request);

  if (
    await consumeRateLimit("email:backfill-bodies", clientIp(request), {
      windowMs: RATE_WINDOW_MS,
      max: RATE_MAX,
    })
  ) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas solicitudes" },
      { status: 429 },
    );
  }

  try {
    let limit: number | undefined;
    if (request.headers.get("content-type")?.includes("application/json")) {
      const read = await readCappedJson(request, BODY_MAX_BYTES);
      if (!read.ok) {
        return NextResponse.json(
          { ok: false, error: "Datos no válidos" },
          { status: read.status },
        );
      }
      const raw = (read.value as { limit?: unknown })?.limit;
      if (raw !== undefined) {
        if (typeof raw !== "number" || !Number.isFinite(raw)) {
          return NextResponse.json(
            { ok: false, error: "limit debe ser un número" },
            { status: 400 },
          );
        }
        limit = raw;
      }
    }

    const admin = createSupabaseAdminClient();
    const result = await backfillMissingBodies(admin, { limit });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (e) {
    logRouteError({
      route: "POST /api/email/backfill-bodies",
      status: 500,
      errorClass: errorClassOf(e),
      requestId,
    });
    return NextResponse.json(
      { ok: false, error: "No se pudo rellenar" },
      { status: 500 },
    );
  }
}

export const POST = withJsonErrors(
  "POST /api/email/backfill-bodies",
  postBackfill,
);
