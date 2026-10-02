import { NextResponse } from "next/server";
import { requireApiSession, requireLeadWriter } from "@/lib/api-auth";
import { getSessionLeadRepository } from "@/lib/repository/get-repository";
import {
  constrainLeadPatch,
  filterReadableLeads,
} from "@/lib/leads/enforce-lead-write";
import {
  changedKeys,
  dispatchLeadUpdated,
} from "@/lib/automations/dispatch";
import { validateLeadPatch } from "@/lib/leads/validate-lead-patch";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const denied = await requireApiSession({ allowVisitor: true });
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const repo = await getSessionLeadRepository();
    const found = await repo.get(id);
    const visible = found ? await filterReadableLeads([found]) : [];
    const lead = visible[0] ?? null;
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
  const denied = await requireLeadWriter();
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
    const gate = await constrainLeadPatch(repo, id, parsed.value);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }
    const lead = await repo.update(id, gate.patch);
    const automation = dispatchLeadUpdated(lead, changedKeys(gate.patch));
    return NextResponse.json({ lead, automation });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al actualizar lead";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const denied = await requireLeadWriter();
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const repo = await getSessionLeadRepository();
    const gate = await constrainLeadPatch(repo, id, {});
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }
    await repo.archive(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al archivar lead";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
