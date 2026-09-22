import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import { readCappedJson } from "@/lib/rate-limit";
import {
  getActiveProvider,
  getSessionLeadRepository,
} from "@/lib/repository/get-repository";
import { filterLeads } from "@/lib/leads/filter-leads";
import { validateLeadCreate } from "@/lib/leads/validate-lead";
import type { LeadFilters, LeadStatus } from "@/lib/domain/lead";
import {
  changedKeys,
  dispatchLeadCreated,
  dispatchLeadUpdated,
  summarizeDispatch,
} from "@/lib/automations/dispatch";

export const dynamic = "force-dynamic";

function parseBool(v: string | null): boolean | null {
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

export async function GET(request: Request) {
  const denied = await requireApiSession();
  if (denied) return denied;
  try {
    const { searchParams } = new URL(request.url);
    const repo = await getSessionLeadRepository();
    const leads = await repo.list();

    const filters: LeadFilters = {
      search: searchParams.get("q") || undefined,
      status: searchParams.getAll("status") as LeadStatus[],
      province: searchParams.getAll("province"),
      city: searchParams.getAll("city"),
      employeesMin: searchParams.get("empMin")
        ? Number(searchParams.get("empMin"))
        : null,
      employeesMax: searchParams.get("empMax")
        ? Number(searchParams.get("empMax"))
        : null,
      createdFrom: searchParams.get("createdFrom"),
      createdTo: searchParams.get("createdTo"),
      activityFrom: searchParams.get("activityFrom"),
      activityTo: searchParams.get("activityTo"),
      hasEmail: parseBool(searchParams.get("hasEmail")),
      hasPhone: parseBool(searchParams.get("hasPhone")),
      hasWebsite: parseBool(searchParams.get("hasWebsite")),
      hasLinkedin: parseBool(searchParams.get("hasLinkedin")),
      favorite: parseBool(searchParams.get("favorite")),
    };

    const filtered = filterLeads(leads, filters);
    return NextResponse.json({
      leads: filtered,
      total: filtered.length,
      syncedAt: new Date().toISOString(),
      provider: getActiveProvider(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al listar leads";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requireApiSession();
  if (denied) return denied;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = validateLeadCreate(body);
    if (!result.ok || !result.value) {
      return NextResponse.json(
        {
          error: "Datos del lead no válidos",
          fieldErrors: result.errors,
        },
        { status: 400 },
      );
    }

    const repo = await getSessionLeadRepository();
    const lead = await repo.create(result.value);
    const automation = dispatchLeadCreated(lead);
    return NextResponse.json({ lead, automation }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al crear el lead";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const MAX_BULK_BODY_BYTES = 256 * 1024;

export async function PATCH(request: Request) {
  const denied = await requireApiSession();
  if (denied) return denied;
  try {
    const parsed = await readCappedJson(request, MAX_BULK_BODY_BYTES);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: "Payload no válido o demasiado grande" },
        { status: parsed.status },
      );
    }
    const { ids, patch } = parsed.value as {
      ids: string[];
      patch: Record<string, unknown>;
    };
    if (!ids?.length || !patch) {
      return NextResponse.json({ error: "ids y patch requeridos" }, { status: 400 });
    }
    const repo = await getSessionLeadRepository();
    const updated = [];
    const automations = [];
    const changed = changedKeys(patch);
    for (const id of ids) {
      const lead = await repo.update(id, patch);
      updated.push(lead);
      automations.push(dispatchLeadUpdated(lead, changed));
    }
    return NextResponse.json({
      leads: updated,
      automation: summarizeDispatch(automations),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error en actualización masiva";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
