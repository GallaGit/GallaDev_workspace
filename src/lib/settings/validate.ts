import type { FieldErrors, SettingsPatch } from "./types";

const AI_PROVIDERS = new Set(["groq"]);

export function validateSettingsPatch(patch: SettingsPatch): FieldErrors {
  const errors: FieldErrors = {};

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
