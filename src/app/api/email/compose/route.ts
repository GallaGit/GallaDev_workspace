import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { isCompanyMailbox } from "@/lib/email/mailboxes";
import { sendCompose } from "@/lib/email/send-compose";
import { logRouteError, errorClassOf, requestIdFrom } from "@/lib/route-log";
import { clientIp, isRateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 10;

/**
 * POST /api/email/compose — enviar correo nuevo desde hola@ u ociel@.
 * Body: { mailbox, to, subject, text, html?, draftId?, leadId? }
 * Auth: Admin.
 */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const requestId = requestIdFrom(request);

  if (
    isRateLimited("email:compose", clientIp(request), {
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
    const body = (await request.json()) as Record<string, unknown>;
    const rawMailbox =
      typeof body.mailbox === "string" ? body.mailbox.trim().toLowerCase() : "";
    if (!isCompanyMailbox(rawMailbox)) {
      return NextResponse.json(
        { ok: false, error: "Buzón de origen no válido" },
        { status: 400 },
      );
    }

    const to = typeof body.to === "string" ? body.to.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const html = typeof body.html === "string" ? body.html.trim() : undefined;
    const draftId =
      typeof body.draftId === "string" && body.draftId.trim()
        ? body.draftId.trim()
        : undefined;
    const leadId =
      typeof body.leadId === "string" && body.leadId.trim()
        ? body.leadId.trim()
        : null;

    if (!text) {
      return NextResponse.json(
        { ok: false, error: "El cuerpo no puede estar vacío" },
        { status: 400 },
      );
    }

    const admin = createSupabaseAdminClient();
    const result = await sendCompose(admin, {
      mailbox: rawMailbox,
      to,
      subject,
      bodyText: text,
      bodyHtml: html || undefined,
      draftId,
      leadId,
    });

    if (!result.sent) {
      const statusMap: Record<string, number> = {
        "no-client": 503,
        "invalid-mailbox": 400,
        "invalid-to": 400,
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
