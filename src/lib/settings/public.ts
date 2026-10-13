import { isAuthDisabled } from "@/lib/auth";
import { maskSourcedSecret } from "./mask";
import type { PublicSettings, ResolvedSettings } from "./types";

export function toPublicSettings(raw: ResolvedSettings): PublicSettings {
  return {
    authDisabled: isAuthDisabled(),
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
  };
}
