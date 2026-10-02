import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isVisitorRequest } from "@/lib/demo/visitor-request";
import { visitorDeniedResponse } from "@/lib/demo/gate";
import { logRouteError, errorClassOf, requestIdFrom } from "@/lib/route-log";
import { prepareEmailHtml, capEmailText } from "@/lib/email/sanitize-email-html";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/email/threads/[id] — hilo con sus mensajes y adjuntos.
 * Auth: sesión + RLS (Admin).
 */
export async function GET(request: Request, ctx: Ctx) {
  if (await isVisitorRequest()) return visitorDeniedResponse();
  const requestId = requestIdFrom(request);
  const { id } = await ctx.params;

  try {
    const supabase = await createSupabaseServerClient();

    const { data: thread, error: threadErr } = await supabase
      .from("email_threads")
      .select("*")
      .eq("id", id)
      .single();

    if (threadErr || !thread) {
      return NextResponse.json({ ok: false, error: "Hilo no encontrado" }, { status: 404 });
    }

    const { data: messages } = await supabase
      .from("email_messages")
      .select("id, resend_email_id, message_id, direction, from_address, from_name, to_addresses, cc_addresses, subject, body_html, body_text, send_status, received_at, created_at")
      .eq("thread_id", id)
      .order("received_at", { ascending: true });

    const messageIds = (messages ?? []).map((m) => m.id);
    let attachments: Record<string, unknown>[] = [];
    if (messageIds.length > 0) {
      const { data: atts } = await supabase
        .from("email_attachments")
        .select("id, message_id, filename, content_type, size_bytes")
        .in("message_id", messageIds);
      attachments = atts ?? [];
    }

    const safeMessages = (messages ?? []).map((message) => ({
      ...message,
      body_html: prepareEmailHtml(
        typeof message.body_html === "string" ? message.body_html : null,
      ),
      body_text: capEmailText(
        typeof message.body_text === "string" ? message.body_text : null,
      ),
    }));

    return NextResponse.json({
      ok: true,
      thread,
      messages: safeMessages,
      attachments,
    });
  } catch (e) {
    logRouteError({
      route: `GET /api/email/threads/${id}`,
      status: 500,
      errorClass: errorClassOf(e),
      requestId,
    });
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

/**
 * PATCH /api/email/threads/[id] — marcar leído, enlazar a lead.
 * Auth: sesión + RLS (Admin).
 * Body: { is_read?: boolean, lead_id?: string | null }
 */
export async function PATCH(request: Request, ctx: Ctx) {
  if (await isVisitorRequest()) return visitorDeniedResponse();
  const requestId = requestIdFrom(request);
  const { id } = await ctx.params;

  try {
    const supabase = await createSupabaseServerClient();
    const body = (await request.json()) as Record<string, unknown>;

    const patch: Record<string, unknown> = {};
    if (typeof body.is_read === "boolean") patch.is_read = body.is_read;
    if (body.lead_id !== undefined) patch.lead_id = body.lead_id;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "Nada que actualizar" }, { status: 400 });
    }

    const { data: thread, error } = await supabase
      .from("email_threads")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !thread) {
      return NextResponse.json(
        { ok: false, error: "No se pudo actualizar el hilo" },
        { status: error?.code === "PGRST116" ? 404 : 500 },
      );
    }

    return NextResponse.json({ ok: true, thread });
  } catch (e) {
    logRouteError({
      route: `PATCH /api/email/threads/${id}`,
      status: 500,
      errorClass: errorClassOf(e),
      requestId,
    });
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
