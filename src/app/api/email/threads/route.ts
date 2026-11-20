import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { withJsonErrors } from "@/lib/api-handler";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logRouteError, errorClassOf, requestIdFrom } from "@/lib/route-log";
import { readCappedJson } from "@/lib/rate-limit";
import { parseThreadBulkPatch } from "@/lib/email/email-payload";
import { parseThreadView, threadDbPatch } from "@/lib/email/thread-state";
import {
  applyThreadViewFilter,
  stripMessageEmbed,
  threadListSelect,
} from "@/lib/email/thread-view-query";
import { isCompanyMailbox } from "@/lib/email/mailboxes";
import { isUuid } from "@/lib/supabase/lead-lookup";
import {
  MAX_SEARCH_THREADS,
  buildTsQuery,
  parseSearchQuery,
  parseSearchScope,
} from "@/lib/email/thread-search";

export const dynamic = "force-dynamic";

/**
 * GET /api/email/threads — lista de hilos del buzón.
 *
 * Auth: requireAdmin y RLS (solo Admin ve los hilos).
 * Query params:
 *   - limit (default 50, max 100)
 *   - offset (default 0)
 *   - unread (si "true", solo no leídos)
 *   - mailbox (hola@galladev.com | ociel@galladev.com; omitir = todos)
 *   - view (inbox | sent | archived | trash; default inbox)
 *   - q (opcional, máx. 200 caracteres): busca por remitente, asunto y cuerpo
 *     con FTS (`search_tsv`, config spanish, prefijo por palabra)
 *   - scope (view | all; default view): `all` busca en todas las vistas
 *   - lead_id (UUID): hilos vinculados a ese lead, de todas las bandejas
 *     salvo Papelera (ficha del lead); ignora `view`
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
    const leadIdParam = url.searchParams.get("lead_id");
    if (leadIdParam !== null && !isUuid(leadIdParam)) {
      return NextResponse.json({ ok: false, error: "Lead no válido" }, { status: 400 });
    }
    const view = leadIdParam ? "inbox" : parseThreadView(url.searchParams.get("view"));
    const search = parseSearchQuery(url.searchParams.get("q"));
    if (!search.ok) {
      return NextResponse.json({ ok: false, error: search.error }, { status: 400 });
    }
    const scope = search.q ? parseSearchScope(url.searchParams.get("scope")) : "view";

    let matchIds: string[] | null = null;
    if (search.q) {
      const tsQuery = buildTsQuery(search.q);
      if (!tsQuery) {
        return NextResponse.json({ ok: true, view, scope, q: search.q, threads: [] });
      }
      const [byThread, byMessage] = await Promise.all([
        supabase
          .from("email_threads")
          .select("id")
          .textSearch("search_tsv", tsQuery, { config: "spanish" })
          .limit(MAX_SEARCH_THREADS),
        supabase
          .from("email_messages")
          .select("thread_id")
          .textSearch("search_tsv", tsQuery, { config: "spanish" })
          .order("received_at", { ascending: false })
          .limit(MAX_SEARCH_THREADS * 2),
      ]);
      const searchError = byThread.error ?? byMessage.error;
      if (searchError) {
        logRouteError({
          route: "GET /api/email/threads",
          status: 500,
          errorClass: `Supabase:${searchError.code}`,
          requestId,
        });
        return NextResponse.json(
          { ok: false, error: "No se pudo buscar en el correo" },
          { status: 500 },
        );
      }
      const ids = new Set<string>();
      for (const row of (byThread.data ?? []) as { id: string }[]) ids.add(row.id);
      for (const row of (byMessage.data ?? []) as { thread_id: string }[]) {
        ids.add(row.thread_id);
      }
      matchIds = Array.from(ids).slice(0, MAX_SEARCH_THREADS);
      if (matchIds.length === 0) {
        return NextResponse.json({ ok: true, view, scope, q: search.q, threads: [] });
      }
    }

    let query = supabase
      .from("email_threads")
      .select(threadListSelect(view, scope))
      .order("last_message_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (matchIds) {
      query = query.in("id", matchIds);
    }

    if (leadIdParam) {
      query = query.eq("lead_id", leadIdParam).is("trashed_at", null);
    } else if (scope !== "all") {
      query = applyThreadViewFilter(query, view);
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

    return NextResponse.json({
      ok: true,
      view,
      scope,
      q: search.q,
      threads: stripMessageEmbed(data ?? []),
    });
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
