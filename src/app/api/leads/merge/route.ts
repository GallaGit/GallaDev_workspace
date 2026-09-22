import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import {
  buildEmptyFieldMerge,
  MERGEABLE_FIELD_LABELS,
} from "@/lib/leads/merge-leads";
import { getSessionLeadRepository } from "@/lib/repository/get-repository";
import {
  changedKeys,
  dispatchLeadUpdated,
} from "@/lib/automations/dispatch";

export const dynamic = "force-dynamic";

type MergeBody = {
  keepId?: unknown;
  archiveId?: unknown;
};

export async function POST(request: Request) {
  const denied = await requireApiSession();
  if (denied) return denied;
  try {
    const body = (await request.json()) as MergeBody;
    const keepId =
      typeof body.keepId === "string" ? body.keepId.trim() : "";
    const archiveId =
      typeof body.archiveId === "string" ? body.archiveId.trim() : "";

    if (!keepId || !archiveId) {
      return NextResponse.json(
        { error: "Faltan keepId y archiveId" },
        { status: 400 },
      );
    }
    if (keepId === archiveId) {
      return NextResponse.json(
        { error: "keepId y archiveId deben ser distintos" },
        { status: 400 },
      );
    }

    const repo = await getSessionLeadRepository();
    const [keep, archive] = await Promise.all([
      repo.get(keepId),
      repo.get(archiveId),
    ]);

    if (!keep) {
      return NextResponse.json(
        { error: "Lead a conservar no encontrado" },
        { status: 404 },
      );
    }
    if (!archive) {
      return NextResponse.json(
        { error: "Lead a archivar no encontrado" },
        { status: 404 },
      );
    }

    const { patch, filledKeys } = buildEmptyFieldMerge(keep, archive);

    let updated = keep;
    let automation: ReturnType<typeof dispatchLeadUpdated> | undefined;
    if (Object.keys(patch).length > 0) {
      updated = await repo.update(keepId, patch);
      automation = dispatchLeadUpdated(updated, changedKeys(patch));
    }

    const filledLabels = filledKeys.map((k) => MERGEABLE_FIELD_LABELS[k]);
    const summary =
      filledLabels.length > 0
        ? `Fusión: rellenados ${filledLabels.join(", ")} desde «${archive.companyName}» (${archiveId.slice(0, 8)}…); lead origen archivado.`
        : `Fusión: sin campos vacíos que rellenar desde «${archive.companyName}» (${archiveId.slice(0, 8)}…); lead origen archivado.`;

    await repo.appendActivity(keepId, summary, "merged");

    if (!archive.archived) {
      await repo.archive(archiveId);
    }

    // Re-read keeper after activity/update for fresh lastEditedTime
    const fresh = (await repo.get(keepId)) ?? updated;

    return NextResponse.json({
      lead: fresh,
      filledKeys,
      filledLabels,
      archivedId: archiveId,
      automation,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error al fusionar leads";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
