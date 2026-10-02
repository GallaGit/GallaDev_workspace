import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createServerClient = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({
  createServerClient,
}));

function request(path: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

function clientWithRole(role: string | null) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-1", email: "new@b.c" } },
        error: null,
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { role },
            error: null,
          }),
        }),
      }),
    }),
  };
}

beforeEach(() => {
  createServerClient.mockReset();
  vi.stubEnv("AUTH_DISABLED", "false");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("DEMO_MODE_ENABLED", "false");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("proxy sin rol", () => {
  it("manda la página a /pending y la API responde no_profile", async () => {
    createServerClient.mockReturnValue(clientWithRole(null));
    const { proxy } = await import("@/proxy");

    const page = await proxy(request("/leads"));
    expect(page.status).toBeGreaterThanOrEqual(300);
    expect(page.headers.get("location")).toContain("/pending");
    expect(page.headers.get("content-security-policy")).toContain("script-src");
    expect(page.headers.get("content-security-policy")).not.toMatch(
      /script-src[^;]*unsafe-inline/,
    );

    const api = await proxy(request("/api/leads"));
    expect(api.status).toBe(401);
    expect(await api.json()).toMatchObject({ code: "no_profile" });
  });

  it("deja pasar POST /api/auth/login sin sesión", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(
      new NextRequest(new URL("http://localhost:3000/api/auth/login"), {
        method: "POST",
      }),
    );
    expect(res.status).toBe(200);
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("deja pasar a un Seller y no lo manda a /pending", async () => {
    createServerClient.mockReturnValue(clientWithRole("Seller"));
    const { proxy } = await import("@/proxy");
    const res = await proxy(request("/leads"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-nonce")).toBeNull();
    expect(res.headers.get("content-security-policy")).toMatch(/nonce-/);
  });
});
