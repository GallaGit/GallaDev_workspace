import { NextResponse } from "next/server";
import { getApiSession, requireApiSession } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { queryAudit, resolveAuditLabels } from "@/lib/audit/query";
import {
  LEAD_HISTORY_LIMIT,
  type AuditListResponse,
} from "@/lib/audit/types";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/leads/[id]/history — eventos del lead. RLS filtra: Seller solo
 * ve los de leads propios; Viewer y Admin, los de cualquier lead.
 */
export async function GET(_request: Request, ctx: Ctx) {
  const denied = await requireApiSession();
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
    }
    const viewer = await getApiSession();
    if (!viewer) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const sb = await createSupabaseServerClient();
    const { entries, total } = await queryAudit(sb, {
      leadId: id,
      page: 1,
      pageSize: LEAD_HISTORY_LIMIT,
    });
    const body: AuditListResponse = {
      entries,
      total,
      page: 1,
      pageSize: LEAD_HISTORY_LIMIT,
      viewerId: viewer.id,
      labels: await resolveAuditLabels(entries, viewer),
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al leer el historial";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
