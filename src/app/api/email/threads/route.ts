import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { withJsonErrors } from "@/lib/api-handler";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logRouteError, errorClassOf, requestIdFrom } from "@/lib/route-log";
import { readCappedJson } from "@/lib/rate-limit";
import { parseThreadBulkPatch } from "@/lib/email/email-payload";
import { parseThreadView, threadDbPatch } from "@/lib/email/thread-state";
import { isCompanyMailbox } from "@/lib/email/mailboxes";

export const dynamic = "force-dynamic";

const THREAD_LIST_COLUMNS =
  "id, subject, from_address, from_name, mailbox_address, last_message_at, is_read, message_count, lead_id, created_at, archived_at, trashed_at, last_snippet, has_attachments";

/**
 * GET /api/email/threads — lista de hilos del buzón.
 *
 * Auth: requireAdmin y RLS (solo Admin ve los hilos).
 * Query params:
 *   - limit (default 50, max 100)
 *   - offset (default 0)
 *   - unread (si "true", solo no leídos)
 *   - mailbox (hola@galladev.com | ociel@galladev.com; omitir = todos)
 *   - view (inbox | archived | trash; default inbox)
 */
async function listThreads(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const requestId = requestIdFrom(request);

  try {
    const supabase = await createSupabaseServerClient();
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
    const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);
    const unreadOnly = url.searchParams.get("unread") === "true";
    const mailboxParam = (url.searchParams.get("mailbox") ?? "").trim().toLowerCase();
    const view = parseThreadView(url.searchParams.get("view"));

    let query = supabase
      .from("email_threads")
      .select(THREAD_LIST_COLUMNS)
      .order("last_message_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (view === "trash") {
      query = query.not("trashed_at", "is", null);
    } else {
      query = query.is("trashed_at", null);
      query =
        view === "archived"
          ? query.not("archived_at", "is", null)
          : query.is("archived_at", null);
    }

    if (unreadOnly) {
      query = query.eq("is_read", false);
    }

    if (isCompanyMailbox(mailboxParam)) {
      query = query.eq("mailbox_address", mailboxParam);
    }

    const { data, error } = await query;

    if (error) {
      logRouteError({
        route: "GET /api/email/threads",
        status: 500,
        errorClass: `Supabase:${error.code}`,
        requestId,
      });
      return NextResponse.json(
        { ok: false, error: "No se pudieron cargar los hilos" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, view, threads: data ?? [] });
  } catch (e) {
    logRouteError({
      route: "GET /api/email/threads",
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

/**
 * PATCH /api/email/threads — acción masiva sobre hilos seleccionados.
 *
 * Auth: requireAdmin y RLS (policy UPDATE solo Admin).
 * Body: { ids: uuid[] (1–100), is_read?: boolean, archived?: boolean,
 *         trashed?: boolean }
 * Solo toca las columnas de estado; nunca lead_id ni contenido.
 * Responde con los ids realmente actualizados (los que RLS deja ver).
 */
async function bulkPatchThreads(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const requestId = requestIdFrom(request);

  try {
    const read = await readCappedJson(request, 16 * 1024);
    if (!read.ok) {
      return NextResponse.json(
        { ok: false, error: "Datos del correo no válidos" },
        { status: read.status },
      );
    }
    const parsed = parseThreadBulkPatch(read.value);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("email_threads")
      .update(threadDbPatch(parsed.value.patch))
      .in("id", parsed.value.ids)
      .select("id");

    if (error) {
      logRouteError({
        route: "PATCH /api/email/threads",
        status: 500,
        errorClass: `Supabase:${error.code}`,
        requestId,
      });
      return NextResponse.json(
        { ok: false, error: "No se pudieron actualizar los hilos" },
        { status: 500 },
      );
    }

    const updated = (data ?? []).map((row: { id: string }) => row.id);
    return NextResponse.json({ ok: true, updated });
  } catch (e) {
    logRouteError({
      route: "PATCH /api/email/threads",
      status: 500,
      errorClass: errorClassOf(e),
      requestId,
    });
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export const GET = withJsonErrors("GET /api/email/threads", listThreads);
export const PATCH = withJsonErrors("PATCH /api/email/threads", bulkPatchThreads);
