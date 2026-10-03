import { NextResponse } from "next/server";
import { clientIp, consumeRateLimit } from "@/lib/rate-limit";
import { verifyInboundWebhook } from "@/lib/email/inbound-verify";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withJsonErrors } from "@/lib/api-handler";
import { errorClassOf, logRouteError, requestIdFrom } from "@/lib/route-log";

export const dynamic = "force-dynamic";

/**
 * POST /api/email/inbound — Resend inbound webhook.
 *
 * Auth: firma Svix (no sesión de usuario).
 * Flujo: verificar firma → filtrar allowlist (hola@ u ociel@) → deduplicar →
 *        guardar hilo/mensaje en Supabase con service_role.
 *
 * Rate-limit en memoria best-effort (misma estrategia que /api/ingest/lead).
 * Body crudo ≤ 256 KB (Resend inbound metadata, sin el cuerpo del correo).
 */

const MAX_BODY_BYTES = 256 * 1024;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 60;

async function postInbound(request: Request) {
  const requestId = requestIdFrom(request);

  if (
    await consumeRateLimit("email:inbound", clientIp(request), {
      windowMs: RATE_WINDOW_MS,
      max: RATE_MAX,
    })
  ) {
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      { status: 429 },
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unreadable body" },
      { status: 400 },
    );
  }

  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Payload too large" },
      { status: 413 },
    );
  }

  const verification = verifyInboundWebhook(rawBody, {
    "svix-id": request.headers.get("svix-id"),
    "svix-timestamp": request.headers.get("svix-timestamp"),
    "svix-signature": request.headers.get("svix-signature"),
  });

  if (!verification.ok) {
    const statusMap: Record<string, number> = {
      "missing-secret": 503,
      "missing-headers": 400,
      "bad-signature": 401,
      "not-email-received": 200,
      "not-our-recipient": 200,
      "bad-payload": 400,
    };
    const status = statusMap[verification.reason] ?? 400;

    if (status >= 400) {
      logRouteError({
        route: "POST /api/email/inbound",
        status,
        errorClass: `WebhookVerify:${verification.reason}`,
        requestId,
      });
    }

    return NextResponse.json(
      { ok: status < 400, reason: verification.reason },
      { status },
    );
  }

  try {
    const { storeInboundEmail } = await import("@/lib/email/inbound-store");
    const admin = createSupabaseAdminClient();
    const result = await storeInboundEmail(admin, verification.event);

    if (!result.stored && result.reason === "duplicate") {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
    }

    if (!result.stored) {
      logRouteError({
        route: "POST /api/email/inbound",
        status: 500,
        errorClass: `StoreError:${result.reason}`,
        requestId,
      });
      return NextResponse.json(
        { ok: false, error: "Failed to store" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { ok: true, threadId: result.threadId, messageId: result.messageId },
      { status: 201 },
    );
  } catch (e) {
    logRouteError({
      route: "POST /api/email/inbound",
      status: 500,
      errorClass: errorClassOf(e),
      requestId,
    });
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}

// 500 con cuerpo: Svix reintenta. Un 500 vacío no se distingue de un crash de módulo.
export const POST = withJsonErrors("POST /api/email/inbound", postInbound, {
  error: "Internal error",
});
