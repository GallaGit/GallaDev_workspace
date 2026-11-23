import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCorreoAccess } from "@/lib/api-auth";
import { withJsonErrors } from "@/lib/api-handler";
import { parseReplyBody } from "@/lib/email/email-payload";
import { readOutboundRequest } from "@/lib/email/outbound-request";
import { logRouteError, errorClassOf, requestIdFrom } from "@/lib/route-log";
import { clientIp, consumeRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/supabase/lead-lookup";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 10;

/**
 * POST /api/email/threads/[id]/reply — enviar respuesta desde el mailbox_address del hilo.
 *
 * Auth: requireCorreoAccess antes del cliente admin. La lectura del hilo usa la
 * sesión (RLS). El insert del mensaje saliente no tiene GRANT para
 * authenticated, así que la escritura sigue en service role después del gate.
 * Body JSON: { text, html?, mode?: "reply" | "replyAll", cc?, bcc? }
 * o multipart/form-data con `payload` (ese JSON) y `files` (adjuntos).
 */
async function postReply(request: Request, ctx: Ctx) {
  const denied = await requireCorreoAccess();
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
    const read = await readOutboundRequest(
      request,
      "El texto de la respuesta es demasiado largo",
    );
    if (!read.ok) {
      return NextResponse.json(
        { ok: false, error: read.error },
        { status: read.status },
      );
    }
    const parsed = parseReplyBody(read.json);
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
      mode: parsed.value.mode,
      cc: parsed.value.cc,
      bcc: parsed.value.bcc,
      attachments: read.attachments,
    });

    if (!result.sent) {
      const statusMap: Record<string, number> = {
        "no-client": 503,
        "no-thread": 404,
        "invalid-body": 400,
        "invalid-mailbox": 400,
        "invalid-recipient": 400,
        "invalid-attachments": 400,
        "send-failed": 502,
        "db-error": 500,
      };
      const fixed: Record<string, string> = {
        "no-client": "No se pudo enviar la respuesta",
        "no-thread": "Hilo no encontrado o sin permiso",
        "invalid-body": "El texto de la respuesta no es válido",
        "invalid-mailbox": "Buzón de origen no válido",
        "invalid-recipient": "El destinatario de la respuesta no es válido",
        "invalid-attachments": "Adjuntos no válidos",
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

    // Borrador de respuesta del hilo: se borra al enviar (RLS Admin).
    await supabase.from("email_drafts").delete().eq("thread_id", id);

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
