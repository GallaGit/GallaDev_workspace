import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { withJsonErrors } from "@/lib/api-handler";
import { backfillLeadLinks } from "@/lib/email/lead-link-backfill";
import { parseBackfillLeadLinksBody } from "@/lib/email/lead-link-backfill-body";
import { logRouteError, errorClassOf, requestIdFrom } from "@/lib/route-log";
import { clientIp, consumeRateLimit, readCappedJson } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 3;
const BODY_MAX_BYTES = 4 * 1024;

/**
 * POST /api/email/backfill-lead-links — vincula hilos existentes sin lead con
 * el único lead cuyo email coincide (misma regla que el webhook).
 * Body opcional: { dryRun?: boolean, limit?: number (1–500, defecto 200),
 *                  offset?: number }
 * Auth: requireAdmin. Idempotente; nunca toca hilos con decisión manual.
 * Probar primero con dryRun: true y continuar con `nextOffset` si no es null.
 */
async function postBackfillLeadLinks(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const requestId = requestIdFrom(request);

  if (
    await consumeRateLimit("email:backfill-lead-links", clientIp(request), {
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
    let raw: unknown = {};
    if (request.headers.get("content-type")?.includes("application/json")) {
      const read = await readCappedJson(request, BODY_MAX_BYTES);
      if (!read.ok) {
        return NextResponse.json(
          { ok: false, error: "Datos no válidos" },
          { status: read.status },
        );
      }
      raw = read.value;
    }
    const parsed = parseBackfillLeadLinksBody(raw);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: parsed.error },
        { status: 400 },
      );
    }

    const admin = createSupabaseAdminClient();
    const result = await backfillLeadLinks(admin, parsed.value);
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (e) {
    logRouteError({
      route: "POST /api/email/backfill-lead-links",
      status: 500,
      errorClass: errorClassOf(e),
      requestId,
    });
    return NextResponse.json(
      { ok: false, error: "No se pudo vincular los hilos" },
      { status: 500 },
    );
  }
}

export const POST = withJsonErrors(
  "POST /api/email/backfill-lead-links",
  postBackfillLeadLinks,
);
