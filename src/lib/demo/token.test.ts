import { afterEach, describe, expect, it, vi } from "vitest";
import { VISITOR_TTL_SECONDS } from "./config";
import { signVisitorToken, verifyVisitorToken } from "./token";

const SECRET = "demo-session-secret-test";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("visitor token", () => {
  it("acepta un token recién firmado y rechaza uno caducado o alterado", () => {
    const now = Date.parse("2026-09-25T12:00:00.000Z");
    const { token, maxAge } = signVisitorToken(SECRET, now);
    expect(maxAge).toBe(VISITOR_TTL_SECONDS);
    expect(verifyVisitorToken(token, SECRET, now + 1000)).toBe(true);
    expect(
      verifyVisitorToken(token, SECRET, now + VISITOR_TTL_SECONDS * 1000 + 1),
    ).toBe(false);
    expect(verifyVisitorToken(`${token}x`, SECRET, now)).toBe(false);
    expect(verifyVisitorToken(token, "otra-clave-distinta-16", now)).toBe(false);
    expect(verifyVisitorToken(undefined, SECRET, now)).toBe(false);
  });
});
