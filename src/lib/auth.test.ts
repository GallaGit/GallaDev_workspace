import { afterEach, describe, expect, it, vi } from "vitest";
import { isAuthDisabled } from "./auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isAuthDisabled", () => {
  it("dev: AUTH_DISABLED=true desactiva aunque haya secreto", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_DISABLED", "true");
    vi.stubEnv("AUTH_SECRET", "secret");
    expect(isAuthDisabled()).toBe(true);
  });

  it("dev: sin AUTH_SECRET desactiva (local sin login)", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_DISABLED", "");
    vi.stubEnv("AUTH_SECRET", "");
    expect(isAuthDisabled()).toBe(true);
  });

  it("dev: con secreto y sin flag activa el auth", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_DISABLED", "");
    vi.stubEnv("AUTH_SECRET", "secret");
    expect(isAuthDisabled()).toBe(false);
  });

  it("prod: AUTH_DISABLED=true NO desactiva (fail-closed)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_DISABLED", "true");
    vi.stubEnv("AUTH_SECRET", "secret");
    expect(isAuthDisabled()).toBe(false);
  });

  it("prod: sin AUTH_SECRET el auth sigue activo (login dará 503)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_DISABLED", "true");
    vi.stubEnv("AUTH_SECRET", "");
    expect(isAuthDisabled()).toBe(false);
  });
});
