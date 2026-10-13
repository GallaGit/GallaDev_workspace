import type { ResolvedSettings } from "./types";

/** Nombres de campo de configuración que cambiaron. Nunca incluye el valor. */
export function settingsAuditChanges(
  before: ResolvedSettings,
  after: ResolvedSettings,
): string[] {
  const fields: Array<[string, string, string]> = [
    ["ai.provider", before.ai.provider.value, after.ai.provider.value],
    ["ai.model", before.ai.model.value, after.ai.model.value],
    ["ai.apiKey", before.ai.apiKey.value, after.ai.apiKey.value],
    ["serpapi.apiKey", before.serpapi.apiKey.value, after.serpapi.apiKey.value],
  ];
  return fields.filter(([, a, b]) => a !== b).map(([name]) => name);
}
