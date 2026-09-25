import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VISITOR_COOKIE } from "./config";
import { verifyVisitorToken } from "./token";
import { resetRateLimits } from "@/lib/rate-limit";

vi.mock("server-only", () => ({}));

const SECRET = "demo-session-secret-test";

beforeEach(() => {
  resetRateLimits();
  vi.stubEnv("DEMO_MODE_ENABLED", "true");
  vi.stubEnv("DEMO_SESSION_SECRET", SECRET);
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/demo/enter", () => {
  it("deja una cookie httpOnly firmada y caduca a las pocas horas", async () => {
    const { POST } = await import("@/app/api/demo/enter/route");
    const res = await POST(
      new Request("http://localhost/api/demo/enter", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${VISITOR_COOKIE}=`);
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie).toMatch(/Max-Age=14400/i);
    const token = /gdw_visitor=([^;]+)/.exec(setCookie)?.[1];
    expect(token).toBeTruthy();
    expect(verifyVisitorToken(decodeURIComponent(token ?? ""), SECRET)).toBe(true);
  });

  it("responde 404 si el flag está apagado", async () => {
    vi.stubEnv("DEMO_MODE_ENABLED", "false");
    const { POST } = await import("@/app/api/demo/enter/route");
    const res = await POST(
      new Request("http://localhost/api/demo/enter", { method: "POST" }),
    );
    expect(res.status).toBe(404);
  });

  it("limita los intentos por IP", async () => {
    const { POST } = await import("@/app/api/demo/enter/route");
    const call = () =>
      POST(
        new Request("http://localhost/api/demo/enter", {
          method: "POST",
          headers: { "x-forwarded-for": "203.0.113.20" },
        }),
      );
    for (let i = 0; i < 8; i += 1) {
      expect((await call()).status).toBe(200);
    }
    const blocked = await call();
    expect(blocked.status).toBe(429);
  });
});
