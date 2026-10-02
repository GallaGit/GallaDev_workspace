import { describe, expect, it } from "vitest";
import { toPublicSettings } from "./public";
import type { ResolvedSettings } from "./types";
import { webhookAuditChanges } from "./audit";

function raw(baseUrl: string): ResolvedSettings {
  const empty = { value: "", source: "none" as const };
  const hook = { value: "https://n8n.example.com/webhook/secret-path", source: "env" as const };
  return {
    n8n: {
      baseUrl: { value: baseUrl, source: "env" },
      apiKey: { value: "nk-secret-1234", source: "env" },
      webhooks: {
        lead_created: hook,
        lead_updated: empty,
        lead_analyzed: empty,
      },
    },
    ai: {
      provider: { value: "groq", source: "default" },
      apiKey: empty,
      model: { value: "model", source: "default" },
    },
    serpapi: { apiKey: empty },
    automations: {
      lead_created: { enabled: { value: true, source: "default" } },
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

describe("toPublicSettings", () => {
  it("no entrega la URL base completa", () => {
    const pub = toPublicSettings(
      raw("https://user:secret@n8n.internal.example.com"),
    );
    const serialized = JSON.stringify(pub);
    expect(serialized).not.toContain("n8n.internal.example.com");
    expect(serialized).not.toContain("user:secret");
    expect(pub.n8n.baseUrl.configured).toBe(true);
    expect(pub.n8n.baseUrl.preview).toMatch(/^https:\/\/••••/);
  });
});

describe("webhookAuditChanges", () => {
  it("nombra el campo y no la URL", () => {
    const before = raw("https://n8n.example.com");
    const after = raw("https://otro.example.com/hook");
    expect(webhookAuditChanges(before, after)).toEqual(["n8n.baseUrl"]);
    expect(webhookAuditChanges(before, after).join(" ")).not.toContain("http");
  });
});
