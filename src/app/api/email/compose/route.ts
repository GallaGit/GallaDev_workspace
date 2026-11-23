import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireCorreoAccess } from "@/lib/api-auth";
import { withJsonErrors } from "@/lib/api-handler";
import { parseComposeBody } from "@/lib/email/email-payload";
import { readOutboundRequest } from "@/lib/email/outbound-request";
import { logRouteError, errorClassOf, requestIdFrom } from "@/lib/route-log";
import { clientIp, consumeRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 10;

/**
 * POST /api/email/compose — enviar correo nuevo desde hola@ u ociel@.
 * Body JSON: { mailbox, to, cc?, bcc?, subject, text, html?, draftId?, leadId? }
 * o multipart/form-data con `payload` (ese JSON) y `files` (adjuntos).
 * Auth: Admin.
 */
async function postCompose(request: Request) {
  const denied = await requireCorreoAccess();
  if (denied) return denied;
  const requestId = requestIdFrom(request);

  if (
    await consumeRateLimit("email:compose", clientIp(request), {
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
    const read = await readOutboundRequest(request, "El cuerpo es demasiado largo");
    if (!read.ok) {
      return NextResponse.json(
        { ok: false, error: read.error },
        { status: read.status },
      );
    }
    const parsed = parseComposeBody(read.json);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: parsed.error },
        { status: 400 },
      );
    }

    const { sendCompose } = await import("@/lib/email/send-compose");
    const admin = createSupabaseAdminClient();
    const result = await sendCompose(admin, {
      mailbox: parsed.value.mailbox,
      to: parsed.value.to,
      subject: parsed.value.subject,
      bodyText: parsed.value.text,
      bodyHtml: parsed.value.html,
      draftId: parsed.value.draftId,
      leadId: parsed.value.leadId,
      cc: parsed.value.cc,
      bcc: parsed.value.bcc,
      attachments: read.attachments,
    });

    if (!result.sent) {
      const statusMap: Record<string, number> = {
        "no-client": 503,
        "invalid-mailbox": 400,
        "invalid-to": 400,
        "invalid-cc": 400,
        "invalid-bcc": 400,
        "invalid-attachments": 400,
        "empty-subject": 400,
        "empty-body": 400,
        "send-failed": 502,
        "db-error": 500,
      };
      logRouteError({
        route: "POST /api/email/compose",
        status: statusMap[result.reason] ?? 500,
        errorClass: `Compose:${result.reason}`,
        requestId,
      });
      return NextResponse.json(
        { ok: false, error: result.detail ?? "No se pudo enviar el correo" },
        { status: statusMap[result.reason] ?? 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        threadId: result.threadId,
        messageId: result.messageId,
      },
      { status: 201 },
    );
  } catch (e) {
    logRouteError({
      route: "POST /api/email/compose",
      status: 500,
      errorClass: errorClassOf(e),
      requestId,
    });
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export const POST = withJsonErrors("POST /api/email/compose", postCompose);
