import { NextResponse } from "next/server";
import { requireAiAnalyzeAccess } from "@/lib/ai/require-ai-access";
import {
  PainAnalysisError,
  analyzeBusinessPains,
} from "@/lib/ai/analyze-lead-pains";
import { isPainAnalysisEmpty } from "@/lib/ai/pain-analysis";
import {
  leadFromGrokBody,
  toGrokPainAnalysisResponse,
} from "@/lib/ai/grok-pain-analysis";
import {
  emptyApiPainAnalysis,
  toApiPainAnalysis,
} from "@/lib/ai/pain-analysis-api";
import { runLeadAnalyze } from "@/lib/ai/run-lead-analyze";
import { getSessionLeadRepository } from "@/lib/repository/get-repository";
import { getSettingsService } from "@/lib/settings/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Grok / AI-engineer contract.
 * Front drawer uses POST /api/leads/:id/analyze (same Groq + Notion path).
 */
export async function POST(request: Request) {
  const denied = await requireAiAnalyzeAccess();
  if (denied) return denied;
  let body: { id?: unknown; lead?: unknown; persist?: unknown; force?: unknown } =
    {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const inline = leadFromGrokBody(body.lead);
  const id =
    (typeof body.id === "string" ? body.id.trim() : "") || inline?.id || "";
  const persistExplicit = body.persist;
  const persist =
    persistExplicit === false ? false : persistExplicit === true ? true : Boolean(id);

  if (!id && !inline) {
    return NextResponse.json({ error: "id o lead requerido" }, { status: 400 });
  }
  if (persist && !id) {
    return NextResponse.json(
      { error: "id requerido para persistir en Notion" },
      { status: 400 },
    );
  }

  if (id) {
    const result = await runLeadAnalyze(id, {
      force: body.force === true,
      persist,
      repository: await getSessionLeadRepository(),
    });
    if (!result.ok) {
      return NextResponse.json(result.body, { status: result.status });
    }
    return NextResponse.json(toGrokPainAnalysisResponse(result.body));
  }

  const lead = inline!;
  const model =
    getSettingsService().getRaw().ai.model.value || "openai/gpt-oss-120b";
  try {
    const analysis = await analyzeBusinessPains(lead);
    if (isPainAnalysisEmpty(analysis)) {
      return NextResponse.json(
        toGrokPainAnalysisResponse({
          leadId: lead.id,
          analysis: emptyApiPainAnalysis({ model }),
          notionUpdated: false,
          notified: false,
          lead,
          empty: true,
        }),
      );
    }
    return NextResponse.json(
      toGrokPainAnalysisResponse({
        leadId: lead.id,
        analysis: toApiPainAnalysis(analysis, { model }),
        notionUpdated: false,
        notified: false,
        lead,
      }),
    );
  } catch (e) {
    if (
      e instanceof PainAnalysisError &&
      (e.code === "empty" || e.code === "invalid")
    ) {
      return NextResponse.json(
        toGrokPainAnalysisResponse({
          leadId: lead.id,
          analysis: emptyApiPainAnalysis({ model }),
          notionUpdated: false,
          notified: false,
          lead,
          empty: true,
        }),
      );
    }
    const message =
      e instanceof Error ? e.message : "Error al analizar el lead";
    return NextResponse.json(
      { error: { code: "ai_error", message } },
      { status: 502 },
    );
  }
}
