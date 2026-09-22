import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import { scoreLead } from "@/lib/leads/lead-scorer";
import { getLeadRepository } from "@/lib/repository/get-repository";

export const dynamic = "force-dynamic";

type ScoreBody = {
  ids?: unknown;
};

export async function POST(request: Request) {
  const denied = await requireApiSession(request);
  if (denied) return denied;
  try {
    let body: ScoreBody = {};
    try {
      body = (await request.json()) as ScoreBody;
    } catch {
      body = {};
    }

    const repo = getLeadRepository();
    let targets;

    if (Array.isArray(body.ids) && body.ids.length > 0) {
      const ids = body.ids.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0,
      );
      if (ids.length === 0) {
        return NextResponse.json(
          { error: "ids debe ser un array de strings" },
          { status: 400 },
        );
      }
      const found = await Promise.all(ids.map((id) => repo.get(id)));
      targets = found.filter((l): l is NonNullable<typeof l> => l != null);
      const missing = ids.length - targets.length;
      if (targets.length === 0) {
        return NextResponse.json(
          { error: "Ningún lead encontrado", missing, requested: ids.length },
          { status: 404 },
        );
      }
    } else {
      // All active leads
      targets = await repo.list();
    }

    let updated = 0;
    let failed = 0;
    const errors: { id: string; error: string }[] = [];
    const leads = [];

    for (const lead of targets) {
      try {
        const { total } = scoreLead(lead);
        if (lead.score === total) {
          // Still count as processed; skip Notion write if unchanged
          leads.push(lead);
          updated += 1;
          continue;
        }
        const saved = await repo.update(lead.id, { score: total });
        leads.push(saved);
        updated += 1;
      } catch (e) {
        failed += 1;
        errors.push({
          id: lead.id,
          error: e instanceof Error ? e.message : "Error al puntuar",
        });
      }
    }

    return NextResponse.json({
      scored: updated,
      failed,
      total: targets.length,
      leads,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error al recalcular scores";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
