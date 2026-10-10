import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { withJsonErrors } from "@/lib/api-handler";
import { parseForwardBody } from "@/lib/email/email-payload";
import { EMAIL_JSON_MAX_BYTES } from "@/lib/email/limits";
import { logRouteError, errorClassOf, requestIdFrom } from "@/lib/route-log";
import { clientIp, consumeRateLimit, readCappedJson } from "@/lib/rate-limit";
import { isUuid } from "@/lib/supabase/lead-lookup";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 10;

/**
 * POST /api/email/threads/[id]/forward — reenviar el último mensaje del hilo.
 *
 * Auth: requireAdmin antes del cliente admin; el hilo se lee con la sesión (RLS).
 * Body: { to: string, text?: string }. Adjuntos originales vía URL firmada de Resend.
 */
async function postForward(request: Request, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const requestId = requestIdFrom(request);
  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json(
      { ok: false, error: "Hilo no encontrado o sin permiso" },
      { status: 404 },
    );
  }

  if (
    await consumeRateLimit("email:forward", clientIp(request), {
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
    const read = await readCappedJson(request, EMAIL_JSON_MAX_BYTES);
    if (!read.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            read.status === 413
              ? "El texto es demasiado largo"
              : "Datos del correo no válidos",
        },
        { status: read.status },
      );
    }
    const parsed = parseForwardBody(read.value);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: parsed.error },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: thread } = await supabase
      .from("email_threads")
      .select("id")
      .eq("id", id)
      .single();

    if (!thread) {
      return NextResponse.json(
        { ok: false, error: "Hilo no encontrado o sin permiso" },
        { status: 404 },
      );
    }

    const { sendForward } = await import("@/lib/email/send-forward");
    const admin = createSupabaseAdminClient();
    const result = await sendForward(admin, {
      threadId: id,
      to: parsed.value.to,
      bodyText: parsed.value.text,
    });

    if (!result.sent) {
      const statusMap: Record<string, number> = {
        "no-client": 503,
        "no-thread": 404,
        "no-message": 404,
        "invalid-body": 400,
        "invalid-mailbox": 400,
        "invalid-recipient": 400,
        "send-failed": 502,
        "db-error": 500,
      };
      const fixed: Record<string, string> = {
        "no-client": "No se pudo reenviar",
        "no-thread": "Hilo no encontrado o sin permiso",
        "invalid-body": "El texto no es válido",
        "invalid-mailbox": "Buzón de origen no válido",
        "invalid-recipient": "Destinatario no válido",
      };
      logRouteError({
        route: `POST /api/email/threads/${id}/forward`,
        status: statusMap[result.reason] ?? 500,
        errorClass: `Forward:${result.reason}`,
        requestId,
      });
      return NextResponse.json(
        {
          ok: false,
          error: fixed[result.reason] ?? result.detail ?? "No se pudo reenviar",
        },
        { status: statusMap[result.reason] ?? 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        messageId: result.messageId,
        attached: result.attached,
        missing: result.missing,
      },
      { status: 201 },
    );
  } catch (e) {
    logRouteError({
      route: `POST /api/email/threads/${id}/forward`,
      status: 500,
      errorClass: errorClassOf(e),
      requestId,
    });
    return NextResponse.json(
      { ok: false, error: "Error interno" },
      { status: 500 },
    );
  }
}

export const POST = withJsonErrors(
  "POST /api/email/threads/[id]/forward",
  postForward,
);
