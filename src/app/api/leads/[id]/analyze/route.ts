import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import { runLeadAnalyze } from "@/lib/ai/run-lead-analyze";
import { getSessionLeadRepository } from "@/lib/repository/get-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const denied = await requireApiSession();
  if (denied) return denied;
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
  });
  return NextResponse.json(result.body, { status: result.status });
}
