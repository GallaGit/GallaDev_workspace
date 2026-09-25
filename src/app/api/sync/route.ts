import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import { isVisitorRequest } from "@/lib/demo/visitor-request";
import {
  getActiveProvider,
  getSessionLeadRepository,
} from "@/lib/repository/get-repository";

export const dynamic = "force-dynamic";

export async function POST() {
  const denied = await requireApiSession({ allowVisitor: true });
  if (denied) return denied;
  try {
    const repo = await getSessionLeadRepository();
    const leads = await repo.list();
    return NextResponse.json({
      ok: true,
      count: leads.length,
      syncedAt: new Date().toISOString(),
      provider: (await isVisitorRequest()) ? "demo" : getActiveProvider(),
      leads,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error de sincronización";
    return NextResponse.json(
      { ok: false, error: message, syncedAt: null },
      { status: 500 },
    );
  }
}
