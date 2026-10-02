import { outboundUrlError } from "./outbound-url";
import { AUTOMATION_ACTION_IDS, type FieldErrors, type SettingsPatch } from "./types";

const AI_PROVIDERS = new Set(["groq"]);

function optionalUrl(path: string, value: string | undefined, errors: FieldErrors) {
  if (value === undefined) return;
  const trimmed = value.trim();
  if (!trimmed) return;
  const error = outboundUrlError(trimmed);
  if (error) errors[path] = error;
}


export function validateSettingsPatch(patch: SettingsPatch): FieldErrors {
  const errors: FieldErrors = {};

  optionalUrl("n8n.baseUrl", patch.n8n?.baseUrl, errors);

  if (patch.n8n?.webhooks) {
    for (const action of AUTOMATION_ACTION_IDS) {
      optionalUrl(`n8n.webhooks.${action}`, patch.n8n.webhooks[action], errors);
    }
  }

  if (patch.automations) {
    for (const action of AUTOMATION_ACTION_IDS) {
      const item = patch.automations[action];
      optionalUrl(`automations.${action}.webhookUrl`, item?.webhookUrl, errors);
    }
  }

  if (patch.ai?.provider !== undefined) {
    const provider = patch.ai.provider.trim().toLowerCase();
    if (provider && !AI_PROVIDERS.has(provider)) {
      errors["ai.provider"] = "Proveedor no soportado. Usa groq.";
    }
  }

  if (patch.ai?.model !== undefined && patch.ai.model.trim().length > 120) {
    errors["ai.model"] = "El nombre del modelo es demasiado largo";
  }

  return errors;
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\/.+/i.test(value.trim());
}
