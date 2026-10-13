import { describe, expect, it } from "vitest";
import { toPublicSettings } from "./public";
import type { ResolvedSettings } from "./types";
import { settingsAuditChanges } from "./audit";

function raw(aiKey: string): ResolvedSettings {
  const empty = { value: "", source: "none" as const };
  return {
    ai: {
      provider: { value: "groq", source: "default" },
      apiKey: aiKey ? { value: aiKey, source: "env" } : empty,
      model: { value: "model", source: "default" },
    },
    serpapi: { apiKey: empty },
    connections: {
      ai: { status: "never", lastSyncedAt: null, lastError: null },
      serpapi: { status: "never", lastSyncedAt: null, lastError: null },
    },
  };
}

describe("toPublicSettings", () => {
  it("no entrega la API key completa", () => {
    const pub = toPublicSettings(raw("gsk-secret-1234567890"));
    expect(JSON.stringify(pub)).not.toContain("gsk-secret-1234567890");
    expect(pub.ai.configured).toBe(true);
  });

  it("ya no expone n8n ni automatizaciones", () => {
    const pub = toPublicSettings(raw("")) as unknown as Record<string, unknown>;
    expect(pub).not.toHaveProperty("n8n");
    expect(pub).not.toHaveProperty("automations");
  });
});

describe("settingsAuditChanges", () => {
  it("nombra el campo y no el valor", () => {
    const changes = settingsAuditChanges(raw("old-key-123"), raw("new-key-456"));
    expect(changes).toEqual(["ai.apiKey"]);
    expect(changes.join(" ")).not.toContain("key-");
  });
});
