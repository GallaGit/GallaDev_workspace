import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { withJsonErrors } from "@/lib/api-handler";
import { rethreadSplitThreads } from "@/lib/email/rethread";
import { getResendClient } from "@/lib/email/resend-client";
import { logRouteError, errorClassOf, requestIdFrom } from "@/lib/route-log";
import { clientIp, consumeRateLimit, readCappedJson } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 3;
const BODY_MAX_BYTES = 4 * 1024;

/**
 * POST /api/email/rethread — fusiona hilos partidos (respuestas que entraron
 * como hilo nuevo) y corrige Message-ID salientes guardados con nuestro id.
 * Body opcional: { dryRun?: boolean, limit?: number } (1–1000, defecto 500).
 * Auth: requireAdmin. Idempotente. Probar primero con dryRun: true.
 */
async function postRethread(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const requestId = requestIdFrom(request);

  if (
    await consumeRateLimit("email:rethread", clientIp(request), {
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
    let dryRun = false;
    if (request.headers.get("content-type")?.includes("application/json")) {
      const read = await readCappedJson(request, BODY_MAX_BYTES);
      if (!read.ok) {
        return NextResponse.json(
          { ok: false, error: "Datos no válidos" },
          { status: read.status },
        );
      }
      const dr = (read.value as { dryRun?: unknown })?.dryRun;
      if (dr !== undefined) {
        if (typeof dr !== "boolean") {
          return NextResponse.json(
            { ok: false, error: "dryRun debe ser sí o no" },
            { status: 400 },
          );
        }
        dryRun = dr;
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
    const result = await rethreadSplitThreads(admin, getResendClient(), {
      limit,
      dryRun,
    });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (e) {
    logRouteError({
      route: "POST /api/email/rethread",
      status: 500,
      errorClass: errorClassOf(e),
      requestId,
    });
    return NextResponse.json(
      { ok: false, error: "No se pudo re-hilar" },
      { status: 500 },
    );
  }
}

export const POST = withJsonErrors(
  "POST /api/email/rethread",
  postRethread,
);
