import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { VISITOR_COOKIE } from "./config";
import { signVisitorToken } from "./token";

const createServerClient = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({
  createServerClient,
}));

const SECRET = "demo-session-secret-test";

function request(path: string, token?: string, method = "GET") {
  const headers = new Headers();
  if (token) headers.set("cookie", `${VISITOR_COOKIE}=${token}`);
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    method,
    headers,
  });
}

beforeEach(() => {
  createServerClient.mockReset();
  createServerClient.mockImplementation(() => {
    throw new Error("supabase ssr");
  });
  vi.stubEnv("DEMO_MODE_ENABLED", "true");
  vi.stubEnv("DEMO_SESSION_SECRET", SECRET);
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("proxy de visitante", () => {
  it("deja pasar /leads sin crear el cliente de Supabase y marca noindex", async () => {
    const { proxy } = await import("@/proxy");
    const token = signVisitorToken(SECRET).token;
    const res = await proxy(request("/leads", token));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("responde 403 en team, ingesta y análisis", async () => {
    const { proxy } = await import("@/proxy");
    const token = signVisitorToken(SECRET).token;
    for (const path of [
      "/api/team",
      "/api/ingest/lead",
      "/api/settings",
      "/api/leads/demo-01/analyze",
    ]) {
      const res = await proxy(request(path, token, "POST"));
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ code: "demo_readonly" });
    }
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("redirige settings, automatizaciones y email a /leads", async () => {
    const { proxy } = await import("@/proxy");
    const token = signVisitorToken(SECRET).token;
    for (const path of ["/settings", "/automations", "/email"]) {
      const res = await proxy(request(path, token));
      expect(res.status).toBeGreaterThanOrEqual(300);
      expect(res.status).toBeLessThan(400);
      expect(res.headers.get("location")).toContain("/leads");
    }
    expect(createServerClient).not.toHaveBeenCalled();
  });
});
