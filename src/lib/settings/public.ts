import { isAuthDisabled } from "@/lib/auth";
import { AUTOMATION_CATALOG } from "./catalog";
import { maskSourcedSecret, maskSourcedUrl } from "./mask";
import {
  AUTOMATION_ACTION_IDS,
  type PublicSettings,
  type ResolvedSettings,
} from "./types";

export function toPublicSettings(raw: ResolvedSettings): PublicSettings {
  return {
    authDisabled: isAuthDisabled(),
    n8n: {
      configured: Boolean(
        raw.n8n.baseUrl.value ||
          raw.n8n.apiKey.value ||
          AUTOMATION_ACTION_IDS.some((action) => raw.n8n.webhooks[action].value),
      ),
      baseUrl: raw.n8n.baseUrl.value,
      apiKey: maskSourcedSecret(raw.n8n.apiKey),
      webhooks: {
        lead_created: maskSourcedUrl(raw.n8n.webhooks.lead_created),
        lead_updated: maskSourcedUrl(raw.n8n.webhooks.lead_updated),
        lead_analyzed: maskSourcedUrl(raw.n8n.webhooks.lead_analyzed),
      },
      connection: raw.connections.n8n,
    },
    ai: {
      configured: Boolean(raw.ai.apiKey.value),
      provider: raw.ai.provider.value || "groq",
      apiKey: maskSourcedSecret(raw.ai.apiKey),
      model: raw.ai.model.value,
      connection: raw.connections.ai,
    },
    serpapi: {
      configured: Boolean(raw.serpapi.apiKey.value),
      apiKey: maskSourcedSecret(raw.serpapi.apiKey),
      connection: raw.connections.serpapi,
    },
    automations: AUTOMATION_ACTION_IDS.map((action) => {
      const meta = AUTOMATION_CATALOG[action];
      return {
        action,
        name: meta.name,
        description: meta.description,
        enabled: raw.automations[action].enabled.value,
        webhook: maskSourcedUrl(raw.n8n.webhooks[action]),
      };
    }),
  };
}
