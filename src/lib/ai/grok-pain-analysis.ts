import "server-only";

import { PAIN_ANALYSIS_PROMPT_VERSION } from "@/lib/ai/analyze-lead-pains";
import {
  type PainAnalysis,
  formatPainAnalysis,
} from "@/lib/ai/pain-analysis";
import type { AnalyzeSuccessBody } from "@/lib/ai/pain-analysis-api";
import type { Lead } from "@/lib/domain/lead";
import { normalizeStatus } from "@/lib/domain/lead";

export type GrokPainAnalysisResponse = {
  evidencia: string[];
  inferencia: string[];
  especulacion: string[];
  analysisText: string;
  model: string;
  promptVersion: string;
  persisted: boolean;
  lead?: Lead;
  automation?: AnalyzeSuccessBody["automation"];
};

export function toGrokPainAnalysisResponse(
  body: AnalyzeSuccessBody,
): GrokPainAnalysisResponse {
  const analysis: PainAnalysis = {
    evidence: body.analysis.evidencia,
    inference: body.analysis.inferencia,
    speculation: body.analysis.especulacion,
  };
  return {
    evidencia: body.analysis.evidencia,
    inferencia: body.analysis.inferencia,
    especulacion: body.analysis.especulacion,
    analysisText: formatPainAnalysis(analysis),
    model: body.analysis.model,
    promptVersion: PAIN_ANALYSIS_PROMPT_VERSION,
    persisted: body.notionUpdated,
    lead: body.lead,
    ...(body.automation ? { automation: body.automation } : {}),
  };
}

function asTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

/** Best-effort Lead from a Grok `{ lead }` body. */
export function leadFromGrokBody(raw: unknown): Lead | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = asTrimmed(r.id) ?? "";
  const companyName = asTrimmed(r.companyName) ?? asTrimmed(r.empresa);
  if (!id && !companyName) return null;

  const services = Array.isArray(r.services)
    ? r.services.filter((item): item is string => typeof item === "string")
    : [];

  return {
    id,
    url: asTrimmed(r.url) ?? "",
    companyName: companyName ?? "Sin nombre",
    website: asTrimmed(r.website),
    email: asTrimmed(r.email),
    emailCommercial: asTrimmed(r.emailCommercial),
    emailManager: asTrimmed(r.emailManager),
    phone: asTrimmed(r.phone),
    address: asTrimmed(r.address),
    postalCode: asTrimmed(r.postalCode),
    city: asTrimmed(r.city),
    cityCanonical: asTrimmed(r.cityCanonical),
    province: asTrimmed(r.province),
    employees: typeof r.employees === "number" ? r.employees : null,
    linkedin: asTrimmed(r.linkedin),
    services,
    status: normalizeStatus(asTrimmed(r.status)),
    lastActivity: asTrimmed(r.lastActivity),
    createdAt: asTrimmed(r.createdAt),
    discoveredAt: asTrimmed(r.discoveredAt),
    notes: asTrimmed(r.notes),
    notesOverflow: asTrimmed(r.notesOverflow),
    emailSubject: asTrimmed(r.emailSubject),
    emailBody: asTrimmed(r.emailBody),
    score: typeof r.score === "number" ? r.score : null,
    manager: asTrimmed(r.manager),
    role: asTrimmed(r.role),
    confidence: asTrimmed(r.confidence),
    software: asTrimmed(r.software),
    source: asTrimmed(r.source),
    lastContact: asTrimmed(r.lastContact),
    nextFollowUp: asTrimmed(r.nextFollowUp),
    favorite: r.favorite === true,
    aiAnalysis: asTrimmed(r.aiAnalysis),
    lastEditedTime: asTrimmed(r.lastEditedTime),
    archived: r.archived === true,
    responsibleId: asTrimmed(r.responsibleId),
  };
}
