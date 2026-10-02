import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { sendReply } from "@/lib/email/send-reply";
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
 * Auth: requireAdmin antes del cliente admin. La lectura del hilo usa la
 * sesión (RLS). El insert del mensaje saliente no tiene GRANT para
 * authenticated, así que la escritura sigue en service role después del gate.
 * Body: { text: string, html?: string }
 */
export async function POST(request: Request, ctx: Ctx) {
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

    const body = (await request.json()) as Record<string, unknown>;
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const html = typeof body.html === "string" ? body.html.trim() : undefined;

    if (!text) {
      return NextResponse.json(
        { ok: false, error: "El texto de la respuesta no puede estar vacío" },
        { status: 400 },
      );
    }

    const admin = createSupabaseAdminClient();
    const result = await sendReply(admin, {
      threadId: id,
      bodyText: text,
      bodyHtml: html || undefined,
    });

    if (!result.sent) {
      const statusMap: Record<string, number> = {
        "no-client": 503,
        "no-thread": 404,
        "send-failed": 502,
        "db-error": 500,
      };
      logRouteError({
        route: `POST /api/email/threads/${id}/reply`,
        status: statusMap[result.reason] ?? 500,
        errorClass: `Reply:${result.reason}`,
        requestId,
      });
      return NextResponse.json(
        { ok: false, error: result.detail ?? "No se pudo enviar la respuesta" },
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
