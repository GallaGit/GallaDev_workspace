import "server-only";

import {
  PainAnalysisError,
  analyzeBusinessPains,
} from "@/lib/ai/analyze-lead-pains";
import {
  formatPainAnalysis,
  hasPainAnalysisSignal,
  isPainAnalysisEmpty,
  painAnalysisToWebhookPayload,
} from "@/lib/ai/pain-analysis";
import {
  type AnalyzeSuccessBody,
  emptyApiPainAnalysis,
  toApiPainAnalysis,
} from "@/lib/ai/pain-analysis-api";
import { dispatchLeadAnalyzed } from "@/lib/automations/dispatch";
import type { AutomationDispatchResult } from "@/lib/automations/dispatch-result";
import type { Lead } from "@/lib/domain/lead";
import { getSessionLeadRepository } from "@/lib/repository/get-repository";
import type { LeadRepository } from "@/lib/repository/lead-repository";
import { getSettingsService } from "@/lib/settings/service";

export type AnalyzeLeadResult =
  | { ok: true; status: 200; body: AnalyzeSuccessBody }
  | { ok: false; status: 404 | 500 | 502; body: Record<string, unknown> };

function currentModel(): string {
  return (
    getSettingsService().getRaw().ai.model.value || "openai/gpt-oss-120b"
  );
}

function analysisMeta() {
  return {
    model: currentModel(),
    analyzedAt: new Date().toISOString(),
  };
}

function emptySuccess(lead: Lead): AnalyzeSuccessBody {
  return {
    leadId: lead.id,
    analysis: emptyApiPainAnalysis(analysisMeta()),
    notionUpdated: false,
    notified: false,
    lead,
    empty: true,
  };
}


export async function runLeadAnalyze(
  id: string,
  options: {
    force?: boolean;
    persist?: boolean;
    repository?: LeadRepository;
  } = {},
): Promise<AnalyzeLeadResult> {
  // Sesión (RLS) si el caller no inyecta repositorio. El singleton
  // service_role queda reservado a ingesta pública y health.
  const repo = options.repository ?? (await getSessionLeadRepository());
  const force = options.force === true;
  const persist = options.persist !== false;

  let lead: Lead | null;
  try {
    lead = await repo.get(id);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al obtener lead";
    return { ok: false, status: 500, body: { error: message } };
  }

  if (!lead) {
    return { ok: false, status: 404, body: { error: "Lead no encontrado" } };
  }

  if (!force && !hasPainAnalysisSignal(lead)) {
    return { ok: true, status: 200, body: emptySuccess(lead) };
  }

  let analysis;
  try {
    analysis = await analyzeBusinessPains(lead);
  } catch (e) {
    if (
      e instanceof PainAnalysisError &&
      (e.code === "empty" || e.code === "invalid")
    ) {
      return { ok: true, status: 200, body: emptySuccess(lead) };
    }
    const message =
      e instanceof Error ? e.message : "Error al analizar el lead";
    return {
      ok: false,
      status: 502,
      body: { error: { code: "ai_error", message } },
    };
  }

  if (isPainAnalysisEmpty(analysis)) {
    return { ok: true, status: 200, body: emptySuccess(lead) };
  }

  const text = formatPainAnalysis(analysis);
  const apiAnalysis = toApiPainAnalysis(analysis, analysisMeta());

  if (!persist) {
    return {
      ok: true,
      status: 200,
      body: {
        leadId: lead.id,
        analysis: apiAnalysis,
        notionUpdated: false,
        notified: false,
        lead,
      },
    };
  }

  let saved: Lead;
  try {
    saved = await repo.update(id, { aiAnalysis: text });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error al guardar el análisis";
    return { ok: false, status: 500, body: { error: message } };
  }

  let activity: AnalyzeSuccessBody["activity"];
  try {
    activity = await repo.getActivity(id);
  } catch (error) {
    console.error("[analyze] activity read failed", {
      leadId: id,
      reason: error instanceof Error ? error.message : "unknown",
    });
  }

  let notified = false;
  let automation: AutomationDispatchResult | undefined;
  try {
    automation = dispatchLeadAnalyzed(
      saved,
      painAnalysisToWebhookPayload(analysis, text),
    );
    notified = automation.status === "dispatched";
  } catch (error) {
    console.error("[analyze] notifyLeadAnalyzed failed", {
      leadId: id,
      reason: error instanceof Error ? error.message : "unknown",
    });
  }

  return {
    ok: true,
    status: 200,
    body: {
      leadId: saved.id,
      analysis: apiAnalysis,
      notionUpdated: true,
      notified,
      lead: saved,
      ...(activity ? { activity } : {}),
      ...(automation ? { automation } : {}),
    },
  };
}
