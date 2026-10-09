import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { withJsonErrors } from "@/lib/api-handler";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logRouteError, errorClassOf, requestIdFrom } from "@/lib/route-log";
import { threadUpdateFromBody } from "@/lib/email/thread-patch";
import { threadDbPatch } from "@/lib/email/thread-state";
import { isUuid } from "@/lib/supabase/lead-lookup";
import { readCappedJson } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/email/threads/[id] — hilo con sus mensajes y adjuntos.
 * Auth: requireAdmin y RLS.
 */
async function getThread(request: Request, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const requestId = requestIdFrom(request);
  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ ok: false, error: "Hilo no encontrado" }, { status: 404 });
  }

  try {
    // Import perezoso: si sanitize-html no carga, el catch responde JSON
    // en vez de tumbar el módulo (500 con cuerpo vacío).
    const { prepareEmailHtml, capEmailText } = await import(
      "@/lib/email/sanitize-email-html"
    );
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
 * PATCH /api/email/threads/[id] — leído/no leído, archivar, papelera,
 * enlazar a lead.
 * Auth: requireAdmin y RLS.
 * Body: { is_read?: boolean, lead_id?: string | null,
 *         archived?: boolean, trashed?: boolean }
 */
async function patchThread(request: Request, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const requestId = requestIdFrom(request);
  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ ok: false, error: "Hilo no encontrado" }, { status: 404 });
  }

  try {
    const read = await readCappedJson(request, 8 * 1024);
    if (!read.ok) {
      return NextResponse.json(
        { ok: false, error: "Datos del correo no válidos" },
        { status: read.status },
      );
    }
    const parsed = threadUpdateFromBody(read.value);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const patch = threadDbPatch(parsed.patch);

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

export const GET = withJsonErrors("GET /api/email/threads/[id]", getThread);
export const PATCH = withJsonErrors(
  "PATCH /api/email/threads/[id]",
  patchThread,
);
