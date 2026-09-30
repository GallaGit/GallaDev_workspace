import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isVisitorRequest } from "@/lib/demo/visitor-request";
import { visitorDeniedResponse } from "@/lib/demo/gate";
import { logRouteError, errorClassOf, requestIdFrom } from "@/lib/route-log";

export const dynamic = "force-dynamic";

/**
 * GET /api/email/threads — lista de hilos del buzón.
 *
 * Auth: sesión de usuario + RLS (solo Admin ve los hilos).
 * Query params:
 *   - limit (default 50, max 100)
 *   - offset (default 0)
 *   - unread (si "true", solo no leídos)
 *   - mailbox (hola@galladev.com | ociel@galladev.com; omitir = todos)
 */
export async function GET(request: Request) {
  if (await isVisitorRequest()) return visitorDeniedResponse();
  const requestId = requestIdFrom(request);

  try {
    const supabase = await createSupabaseServerClient();
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
    const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);
    const unreadOnly = url.searchParams.get("unread") === "true";
    const mailboxParam = (url.searchParams.get("mailbox") ?? "").trim().toLowerCase();

    let query = supabase
      .from("email_threads")
      .select("id, subject, from_address, from_name, mailbox_address, last_message_at, is_read, message_count, lead_id, created_at")
      .order("last_message_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      query = query.eq("is_read", false);
    }

    if (mailboxParam === "hola@galladev.com" || mailboxParam === "ociel@galladev.com") {
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

    return NextResponse.json({ ok: true, threads: data ?? [] });
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
