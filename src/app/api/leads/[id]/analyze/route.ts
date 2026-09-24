import { NextResponse } from "next/server";
import { requireAiAnalyzeAccess } from "@/lib/ai/require-ai-access";
import { runLeadAnalyze } from "@/lib/ai/run-lead-analyze";
import { getSessionLeadRepository } from "@/lib/repository/get-repository";
import { errorClassOf, logRouteError, requestIdFrom } from "@/lib/route-log";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

const ROUTE = "POST /api/leads/:id/analyze";

export async function POST(request: Request, ctx: Ctx) {
  const denied = await requireAiAnalyzeAccess();
  if (denied) return denied;
  const requestId = requestIdFrom(request);
  try {
    const { id } = await ctx.params;
    let force = false;
    try {
      const body = (await request.json()) as { force?: boolean };
      force = body.force === true;
    } catch {
      force = false;
    }

    const result = await runLeadAnalyze(id, {
      force,
      repository: await getSessionLeadRepository(),
      route: ROUTE,
      requestId,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    logRouteError({
      route: ROUTE,
      status: 500,
      errorClass: errorClassOf(e),
      requestId,
    });
    return NextResponse.json(
      { error: "Error al analizar el lead" },
      { status: 500 },
    );
  }
}
