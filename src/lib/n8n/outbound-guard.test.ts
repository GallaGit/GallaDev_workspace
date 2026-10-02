import { describe, expect, it, vi } from "vitest";
import { N8nClient } from "./client";
import { N8nClientError } from "./errors";
import { toClientWebhookResult } from "./public-result";
import type { ResolvedSettings } from "@/lib/settings/types";

function settings(baseUrl: string, webhook = ""): ResolvedSettings {
  const empty = { value: "", source: "none" as const };
  return {
    n8n: {
      baseUrl: { value: baseUrl, source: "file" },
      apiKey: { value: "nk-1234", source: "file" },
      webhooks: {
        lead_created: { value: webhook, source: webhook ? "file" : "none" },
        lead_updated: empty,
        lead_analyzed: empty,
      },
    },
    ai: {
      provider: empty,
      apiKey: empty,
      model: empty,
    },
    serpapi: { apiKey: empty },
    automations: {
      lead_created: { enabled: { value: true, source: "file" } },
      lead_updated: { enabled: { value: false, source: "default" } },
      lead_analyzed: { enabled: { value: false, source: "default" } },
    },
    connections: {
      n8n: { status: "never", lastSyncedAt: null, lastError: null },
      ai: { status: "never", lastSyncedAt: null, lastError: null },
      serpapi: { status: "never", lastSyncedAt: null, lastError: null },
    },
  };
}

describe("N8nClient salidas", () => {
  it("no hace fetch a un host privado ni devuelve el cuerpo al cliente", async () => {
    const fetchFn = vi.fn();
    const client = new N8nClient({
      getSettings: async () => settings("https://127.0.0.1:5678"),
      fetch: fetchFn,
    });
    await expect(client.testConnection()).rejects.toBeInstanceOf(N8nClientError);
    expect(fetchFn).not.toHaveBeenCalled();

    const safe = new N8nClient({
      getSettings: async () =>
        settings("", "https://n8n.example.com/webhook/secret"),
      fetch: fetchFn.mockResolvedValue(
        new Response(JSON.stringify({ secret: "remoto", ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    });
    const result = await safe.triggerWebhook("lead_created", { test: true });
    expect(fetchFn).toHaveBeenCalledOnce();
    const init = (fetchFn.mock.calls as unknown as [string, RequestInit][])[0]?.[1];
    expect(init?.redirect).toBe("manual");
    const clientView = toClientWebhookResult(result);
    expect(clientView).toEqual({
      ok: true,
      status: 200,
      durationMs: result.durationMs,
    });
    expect(JSON.stringify(clientView)).not.toContain("remoto");
  });

  it("no manda la API key si el caller lo pide", async () => {
    const fetchFn = vi.fn(async () => new Response("ok", { status: 200 }));
    const client = new N8nClient({
      getSettings: async () => settings("https://n8n.example.com"),
      fetch: fetchFn,
    });
    const result = await client.testConnection({ sendApiKey: false });
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/API key/);
    expect(fetchFn).toHaveBeenCalledOnce();
    const init = (fetchFn.mock.calls as unknown as [string, RequestInit][])[0]?.[1];
    expect(JSON.stringify(init?.headers)).not.toContain("nk-1234");
  });
});
