import "server-only";

import { createN8nClient } from "@/lib/n8n/client";
import { N8nClientError } from "@/lib/n8n/errors";
import { getSettingsService } from "./service";
import type {
  IntegrationId,
  ResolvedSettings,
  SettingsPatch,
} from "./types";

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
}

function timeoutSignal(ms = 12_000): AbortSignal {
  return AbortSignal.timeout(ms);
}

function overlay(raw: ResolvedSettings, patch?: SettingsPatch): ResolvedSettings {
  if (!patch) return raw;
  const next = structuredClone(raw);
  if (patch.n8n?.baseUrl?.trim()) {
    next.n8n.baseUrl.value = patch.n8n.baseUrl.trim();
  }
  if (patch.n8n?.apiKey?.trim()) {
    next.n8n.apiKey.value = patch.n8n.apiKey.trim();
  }
  if (patch.ai?.apiKey?.trim()) next.ai.apiKey.value = patch.ai.apiKey.trim();
  if (patch.ai?.provider?.trim()) {
    next.ai.provider.value = patch.ai.provider.trim();
  }
  if (patch.ai?.model?.trim()) next.ai.model.value = patch.ai.model.trim();
  if (patch.serpapi?.apiKey?.trim()) {
    next.serpapi.apiKey.value = patch.serpapi.apiKey.trim();
  }
  return next;
}

async function resolveSettings(patch?: SettingsPatch): Promise<ResolvedSettings> {
  const raw = await getSettingsService().getRaw();
  return overlay(raw, patch);
}


async function testAi(patch?: SettingsPatch): Promise<ConnectionTestResult> {
  const settings = await resolveSettings(patch);
  const apiKey = settings.ai.apiKey.value;
  if (!apiKey) return { ok: false, message: "Falta la API key de IA" };

  const provider = (settings.ai.provider.value || "groq").toLowerCase();
  if (provider !== "groq") {
    return {
      ok: false,
      message: `Proveedor ${provider} no tiene test implementado`,
    };
  }

  const response = await fetch("https://api.groq.com/openai/v1/models", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    signal: timeoutSignal(),
  });
  if (!response.ok) {
    return { ok: false, message: `Groq respondió HTTP ${response.status}` };
  }
  return { ok: true, message: "Groq: API key válida" };
}

async function testSerpApi(patch?: SettingsPatch): Promise<ConnectionTestResult> {
  const settings = await resolveSettings(patch);
  const apiKey = settings.serpapi.apiKey.value;
  if (!apiKey) return { ok: false, message: "Falta la API key de SerpAPI" };

  const url = new URL("https://serpapi.com/account.json");
  url.searchParams.set("api_key", apiKey);
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: timeoutSignal(),
  });
  if (!response.ok) {
    return { ok: false, message: `SerpAPI respondió HTTP ${response.status}` };
  }
  const body = (await response.json()) as { error?: string };
  if (body.error) return { ok: false, message: `SerpAPI: ${body.error}` };
  return { ok: true, message: "SerpAPI: API key válida" };
}

async function testN8n(patch?: SettingsPatch): Promise<ConnectionTestResult> {
  const settings = await resolveSettings(patch);
  const client = createN8nClient({ getSettings: async () => settings });
  return client.testConnection();
}

export async function testIntegration(
  id: IntegrationId,
  patch?: SettingsPatch,
): Promise<ConnectionTestResult> {
  try {
    switch (id) {
      case "ai":
        return await testAi(patch);
      case "serpapi":
        return await testSerpApi(patch);
      case "n8n":
        return await testN8n(patch);
    }
  } catch (error) {
    if (error instanceof N8nClientError) {
      return { ok: false, message: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Error al probar la conexión";
    return { ok: false, message };
  }
}

export function isIntegrationId(value: string): value is IntegrationId {
  return (
    value === "n8n" ||
    value === "ai" ||
    value === "serpapi"
  );
}
