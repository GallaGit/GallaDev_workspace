import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import { detectDuplicateGroups } from "@/lib/leads/detect-duplicates";
import { getLeadRepository } from "@/lib/repository/get-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireApiSession();
  if (denied) return denied;
  try {
    const repo = getLeadRepository();
    const leads = await repo.list({ includeArchived: true });
    const groups = detectDuplicateGroups(leads);
    return NextResponse.json({
      groups,
      groupCount: groups.length,
      leadCount: groups.reduce((n, g) => n + g.leads.length, 0),
      scanned: leads.length,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error al detectar duplicados";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}