import { afterEach, describe, expect, it, vi } from "vitest";
import { isAuthDisabled } from "./auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isAuthDisabled", () => {
  it("dev: AUTH_DISABLED=true desactiva", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_DISABLED", "true");
    expect(isAuthDisabled()).toBe(true);
  });

  it("dev: sin flag el auth está activo", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_DISABLED", "");
    expect(isAuthDisabled()).toBe(false);
  });

  it("prod: AUTH_DISABLED=true NO desactiva (fail-closed)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_DISABLED", "true");
    expect(isAuthDisabled()).toBe(false);
  });
});
