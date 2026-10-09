import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { withJsonErrors } from "@/lib/api-handler";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logRouteError, errorClassOf, requestIdFrom } from "@/lib/route-log";
import { isCompanyMailbox } from "@/lib/email/mailboxes";
import { THREAD_VIEWS, type ThreadView, type UnreadCounts } from "@/lib/email/thread-state";

export const dynamic = "force-dynamic";

/**
 * GET /api/email/threads/unread-count — hilos no leídos por vista.
 *
 * Auth: requireAdmin y RLS. Solo cuenta (HEAD), no devuelve filas.
 * Query: mailbox (opcional, allowlist).
 * Respuesta: { ok, counts: { inbox, archived, trash } }
 */
async function unreadCount(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const requestId = requestIdFrom(request);

  try {
    const supabase = await createSupabaseServerClient();
    const url = new URL(request.url);
    const mailboxParam = (url.searchParams.get("mailbox") ?? "").trim().toLowerCase();

    const countFor = async (view: ThreadView) => {
      let query = supabase
        .from("email_threads")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false);
      if (view === "trash") {
        query = query.not("trashed_at", "is", null);
      } else {
        query = query.is("trashed_at", null);
        query =
          view === "archived"
            ? query.not("archived_at", "is", null)
            : query.is("archived_at", null);
      }
      if (isCompanyMailbox(mailboxParam)) {
        query = query.eq("mailbox_address", mailboxParam);
      }
      const { count, error } = await query;
      if (error) throw new Error(`Supabase:${error.code}`);
      return count ?? 0;
    };

    const values = await Promise.all(THREAD_VIEWS.map((view) => countFor(view)));
    const counts = Object.fromEntries(
      THREAD_VIEWS.map((view, i) => [view, values[i]]),
    ) as UnreadCounts;

    return NextResponse.json({ ok: true, counts });
  } catch (e) {
    logRouteError({
      route: "GET /api/email/threads/unread-count",
      status: 500,
      errorClass: errorClassOf(e),
      requestId,
    });
    return NextResponse.json(
      { ok: false, error: "No se pudieron contar los no leídos" },
      { status: 500 },
    );
  }
}

export const GET = withJsonErrors("GET /api/email/threads/unread-count", unreadCount);
