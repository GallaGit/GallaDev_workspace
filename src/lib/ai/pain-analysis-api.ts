import type { PainAnalysis } from "@/lib/ai/pain-analysis";
import type { Lead } from "@/lib/domain/lead";

export type ApiPainAnalysis = {
  evidencia: string[];
  inferencia: string[];
  especulacion: string[];
  summary: string;
  model: string;
  analyzedAt: string;
};

export type AnalyzeSuccessBody = {
  leadId: string;
  analysis: ApiPainAnalysis;
  notionUpdated: boolean;
  notified: boolean;
  lead: Lead;
  activity?: { at: string; type: string; message: string }[];
  empty?: boolean;
};

export function toApiPainAnalysis(
  analysis: PainAnalysis,
  extras: { model: string; analyzedAt?: string },
): ApiPainAnalysis {
  const summary =
    analysis.evidence[0] ||
    analysis.inference[0] ||
    analysis.speculation[0] ||
    "";
  return {
    evidencia: analysis.evidence,
    inferencia: analysis.inference,
    especulacion: analysis.speculation,
    summary,
    model: extras.model,
    analyzedAt: extras.analyzedAt ?? new Date().toISOString(),
  };
}

export function emptyApiPainAnalysis(extras: {
  model: string;
  analyzedAt?: string;
}): ApiPainAnalysis {
  return toApiPainAnalysis(
    { evidence: [], inference: [], speculation: [] },
    extras,
  );
}

export function aiErrorResponse(message: string, status = 502) {
  return {
    body: { error: { code: "ai_error" as const, message } },
    status,
  };
}

export function analyzeSuccessPayload(input: {
  lead: Lead;
  analysis: ApiPainAnalysis;
  notionUpdated: boolean;
  notified: boolean;
  activity?: { at: string; type: string; message: string }[];
  empty?: boolean;
}): AnalyzeSuccessBody {
  return {
    leadId: input.lead.id,
    analysis: input.analysis,
    notionUpdated: input.notionUpdated,
    notified: input.notified,
    lead: input.lead,
    ...(input.activity ? { activity: input.activity } : {}),
    ...(input.empty ? { empty: true } : {}),
  };
}
