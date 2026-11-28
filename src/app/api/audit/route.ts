import { NextResponse } from "next/server";
import { getApiSession, requireAdmin } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseAuditQuery, queryAudit, resolveAuditLabels } from "@/lib/audit/query";
import { AUDIT_PAGE_SIZE, type AuditListResponse } from "@/lib/audit/types";

export const dynamic = "force-dynamic";

/** GET /api/audit — historial global. Solo Admin. Filtros: actor, action, from, to, page. */
export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const viewer = await getApiSession();
    if (!viewer) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const q = parseAuditQuery(new URL(request.url).searchParams, AUDIT_PAGE_SIZE);
    const sb = await createSupabaseServerClient();
    const { entries, total } = await queryAudit(sb, q);
    const body: AuditListResponse = {
      entries,
      total,
      page: q.page,
      pageSize: q.pageSize,
      viewerId: viewer.id,
      labels: await resolveAuditLabels(entries, viewer),
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al leer el historial";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
