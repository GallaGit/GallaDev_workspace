import { afterEach, describe, expect, it, vi } from "vitest";
import { demoSessionSecret, isDemoConfigured, isDemoModeEnabled } from "./config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("DEMO_MODE_ENABLED", () => {
  it("está apagado si no se define", () => {
    vi.stubEnv("DEMO_MODE_ENABLED", "");
    expect(isDemoModeEnabled()).toBe(false);
    expect(isDemoConfigured()).toBe(false);
  });

  it("solo acepta true o 1, y exige secreto", () => {
    vi.stubEnv("DEMO_MODE_ENABLED", "false");
    expect(isDemoModeEnabled()).toBe(false);
    vi.stubEnv("DEMO_MODE_ENABLED", "true");
    vi.stubEnv("DEMO_SESSION_SECRET", "corto");
    expect(isDemoModeEnabled()).toBe(true);
    expect(demoSessionSecret()).toBeNull();
    expect(isDemoConfigured()).toBe(false);
    vi.stubEnv("DEMO_SESSION_SECRET", "demo-session-secret-test");
    expect(isDemoConfigured()).toBe(true);
    vi.stubEnv("DEMO_MODE_ENABLED", "1");
    expect(isDemoModeEnabled()).toBe(true);
  });
});
