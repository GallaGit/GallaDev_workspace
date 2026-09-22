import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import { getLeadRepository } from "@/lib/repository/get-repository";
import type { LeadPatch } from "@/lib/domain/lead";
import {
  changedKeys,
  dispatchLeadUpdated,
} from "@/lib/automations/dispatch";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const denied = await requireApiSession(request);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const repo = getLeadRepository();
    const lead = await repo.get(id);
    if (!lead) {
      return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
    }
    const activity = await repo.getActivity(id);
    return NextResponse.json({ lead, activity });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al obtener lead";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  const denied = await requireApiSession(request);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const patch = (await request.json()) as LeadPatch;
    const repo = getLeadRepository();
    const lead = await repo.update(id, patch);
    const automation = dispatchLeadUpdated(lead, changedKeys(patch));
    return NextResponse.json({ lead, automation });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al actualizar lead";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const denied = await requireApiSession(request);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const repo = getLeadRepository();
    await repo.archive(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al archivar lead";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
