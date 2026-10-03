import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { withJsonErrors } from "@/lib/api-handler";
import { parseReplyBody } from "@/lib/email/email-payload";
import { EMAIL_JSON_MAX_BYTES } from "@/lib/email/limits";
import { logRouteError, errorClassOf, requestIdFrom } from "@/lib/route-log";
import { clientIp, consumeRateLimit, readCappedJson } from "@/lib/rate-limit";
import { isUuid } from "@/lib/supabase/lead-lookup";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 10;

/**
 * POST /api/email/threads/[id]/reply — enviar respuesta desde el mailbox_address del hilo.
 *
 * Auth: requireAdmin antes del cliente admin. La lectura del hilo usa la
 * sesión (RLS). El insert del mensaje saliente no tiene GRANT para
 * authenticated, así que la escritura sigue en service role después del gate.
 * Body: { text: string, html?: string }
 */
async function postReply(request: Request, ctx: Ctx) {
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
    await consumeRateLimit("email:reply", clientIp(request), {
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
              ? "El texto de la respuesta es demasiado largo"
              : "Datos del correo no válidos",
        },
        { status: read.status },
      );
    }
    const parsed = parseReplyBody(read.value);
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

    const { sendReply } = await import("@/lib/email/send-reply");
    const admin = createSupabaseAdminClient();
    const result = await sendReply(admin, {
      threadId: id,
      bodyText: parsed.value.text,
      bodyHtml: parsed.value.html,
    });

    if (!result.sent) {
      const statusMap: Record<string, number> = {
        "no-client": 503,
        "no-thread": 404,
        "invalid-body": 400,
        "invalid-mailbox": 400,
        "invalid-recipient": 400,
        "send-failed": 502,
        "db-error": 500,
      };
      const fixed: Record<string, string> = {
        "no-client": "No se pudo enviar la respuesta",
        "no-thread": "Hilo no encontrado o sin permiso",
        "invalid-body": "El texto de la respuesta no es válido",
        "invalid-mailbox": "Buzón de origen no válido",
        "invalid-recipient": "El destinatario de la respuesta no es válido",
      };
      logRouteError({
        route: `POST /api/email/threads/${id}/reply`,
        status: statusMap[result.reason] ?? 500,
        errorClass: `Reply:${result.reason}`,
        requestId,
      });
      return NextResponse.json(
        {
          ok: false,
          error: fixed[result.reason] ?? result.detail ?? "No se pudo enviar la respuesta",
        },
        { status: statusMap[result.reason] ?? 500 },
      );
    }

    return NextResponse.json(
      { ok: true, messageId: result.messageId },
      { status: 201 },
    );
  } catch (e) {
    logRouteError({
      route: `POST /api/email/threads/${id}/reply`,
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
  "POST /api/email/threads/[id]/reply",
  postReply,
);
