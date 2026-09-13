import { NextResponse } from "next/server";
import {
  getActiveProvider,
  getLeadRepository,
} from "@/lib/repository/get-repository";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const repo = getLeadRepository();
    const leads = await repo.list();
    return NextResponse.json({
      ok: true,
      count: leads.length,
      syncedAt: new Date().toISOString(),
      provider: getActiveProvider(),
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
