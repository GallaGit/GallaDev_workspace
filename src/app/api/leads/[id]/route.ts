import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import { getSessionLeadRepository } from "@/lib/repository/get-repository";
import {
  changedKeys,
  dispatchLeadUpdated,
} from "@/lib/automations/dispatch";
import { validateLeadPatch } from "@/lib/leads/validate-lead-patch";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const denied = await requireApiSession();
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const repo = await getSessionLeadRepository();
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
  const denied = await requireApiSession();
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON no válido" }, { status: 400 });
  }

  const parsed = validateLeadPatch(raw);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, fieldErrors: parsed.fieldErrors },
      { status: 400 },
    );
  }

  try {
    const { id } = await ctx.params;
    const repo = await getSessionLeadRepository();
    const lead = await repo.update(id, parsed.value);
    const automation = dispatchLeadUpdated(lead, changedKeys(parsed.value));
    return NextResponse.json({ lead, automation });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al actualizar lead";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const denied = await requireApiSession();
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const repo = await getSessionLeadRepository();
    await repo.archive(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al archivar lead";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
