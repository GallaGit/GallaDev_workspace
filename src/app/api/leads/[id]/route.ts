import { NextResponse } from "next/server";
import { getApiSession, requireApiSession, requireLeadWriter } from "@/lib/api-auth";
import { getSessionLeadRepository } from "@/lib/repository/get-repository";
import {
  constrainLeadPatch,
  filterReadableLeads,
} from "@/lib/leads/enforce-lead-write";
import { validateLeadPatch } from "@/lib/leads/validate-lead-patch";
import { logAudit } from "@/lib/audit/log-audit";
import { leadUpdateAction, leadUpdateDiff } from "@/lib/audit/audit-diff";

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
    const actor = await getApiSession();
    const repo = await getSessionLeadRepository();
    const gate = await constrainLeadPatch(repo, id, parsed.value);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }
    const before = actor ? await repo.get(id) : null;
    const lead = await repo.update(id, gate.patch);
    if (actor) {
      await logAudit({
        actor,
        action: leadUpdateAction(gate.patch),
        entity: "lead",
        entityId: id,
        diff: leadUpdateDiff(before as Record<string, unknown> | null, gate.patch),
      });
    }
    return NextResponse.json({ lead });
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
    const actor = await getApiSession();
    const repo = await getSessionLeadRepository();
    const gate = await constrainLeadPatch(repo, id, {});
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }
    await repo.archive(id);
    if (actor) {
      await logAudit({
        actor,
        action: "lead.archived",
        entity: "lead",
        entityId: id,
        changedFields: ["archived"],
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al archivar lead";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
