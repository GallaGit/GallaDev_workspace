import type { AutomationAction, ValueSource } from "./types";

export function sourceLabel(source: ValueSource): string {
  switch (source) {
    case "file":
      return "archivo local";
    case "env":
      return ".env";
    case "default":
      return "valor por defecto";
    default:
      return "sin configurar";
  }
}

export const DEFAULT_AI_PROVIDER = "groq";
export const DEFAULT_AI_MODEL = "openai/gpt-oss-120b";

export const AUTOMATION_CATALOG: Record<
  AutomationAction,
  {
    name: string;
    description: string;
    envKeys: readonly string[];
  }
> = {
  lead_created: {
    name: "Nuevo Lead",
    description:
      "Reserva post-alta en el CRM (alias buscar leads). En v1 el workflow de captación no tiene este trigger: no pegues URL ni actives el toggle.",
    envKeys: ["N8N_WEBHOOK_LEAD_CREATED", "N8N_WEBHOOK_BUSCAR_LEADS"],
  },
  lead_updated: {
    name: "Lead actualizado",
    description:
      "Sin flujo n8n en v1. La capa queda lista; no configures webhook hasta una fase posterior.",
    envKeys: [
      "N8N_WEBHOOK_LEAD_UPDATED",
      "N8N_WEBHOOK_EJECUTAR",
      "N8N_WEBHOOK_GENERAR_EMAIL",
    ],
  },
  lead_analyzed: {
    name: "Lead analizado",
    description:
      "Webhook tras Detectar dolores. Se dispara en segundo plano si está activo y hay URL. En v1 no hay trigger n8n ni URL configurada.",
    envKeys: ["N8N_WEBHOOK_LEAD_ANALYZED", "N8N_WEBHOOK_ANALIZAR_LEAD"],
  },
};

/** Legacy n8n action names accepted by the HTTP client and automations API. */
export const LEGACY_ACTION_ALIASES: Record<string, AutomationAction> = {
  buscar_leads: "lead_created",
  analizar_lead: "lead_analyzed",
  generar_email: "lead_updated",
  ejecutar_workflow: "lead_updated",
};

export function resolveAutomationAction(
  value: string,
): AutomationAction | null {
  if (value in AUTOMATION_CATALOG) {
    return value as AutomationAction;
  }
  return LEGACY_ACTION_ALIASES[value] ?? null;
}
