import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "@/proxy";

beforeEach(() => {
  vi.stubEnv("AUTH_DISABLED", "false");
  vi.stubEnv("DEMO_MODE_ENABLED", "false");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function matches(path: string): boolean {
  const re = new RegExp(`^${config.matcher[0]}$`);
  return re.test(path);
}

describe("matcher del proxy", () => {
  it("no intercepta los estáticos de public/", () => {
    expect(matches("/what-it-is/leads-light.webp")).toBe(false);
    expect(matches("/brand/logo.png")).toBe(false);
    expect(matches("/_next/static/chunk.js")).toBe(false);
  });

  it("sigue interceptando páginas y APIs", () => {
    expect(matches("/leads")).toBe(true);
    expect(matches("/que-es")).toBe(true);
    expect(matches("/api/leads")).toBe(true);
  });
});

describe("/que-es sin sesión", () => {
  it("se sirve sin redirigir a /login", async () => {
    const res = await proxy(new NextRequest("http://localhost:3000/que-es"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("una página privada sigue redirigiendo a /login", async () => {
    const res = await proxy(new NextRequest("http://localhost:3000/leads"));
    expect(res.headers.get("location")).toContain("/login");
  });
});
