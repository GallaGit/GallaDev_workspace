import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VISITOR_COOKIE } from "./config";
import { signVisitorToken } from "./token";

const jar = vi.hoisted(() => ({ token: undefined as string | undefined }));
const createSupabaseServerClient = vi.hoisted(() => vi.fn());
const SupabaseLeadRepository = vi.hoisted(() =>
  vi.fn(function SupabaseLeadRepository() {
    throw new Error("SupabaseLeadRepository");
  }),
);

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "gdw_visitor" && jar.token ? { value: jar.token } : undefined,
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient,
}));

vi.mock("@/lib/supabase/supabase-lead-repository", () => ({
  SupabaseLeadRepository,
}));

const SECRET = "demo-session-secret-test";

beforeEach(() => {
  jar.token = undefined;
  createSupabaseServerClient.mockReset();
  createSupabaseServerClient.mockImplementation(async () => {
    throw new Error("session client");
  });
  SupabaseLeadRepository.mockClear();
  vi.stubEnv("DEMO_MODE_ENABLED", "true");
  vi.stubEnv("DEMO_SESSION_SECRET", SECRET);
  vi.stubEnv("AUTH_DISABLED", "false");
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSessionLeadRepository en modo visitante", () => {
  it("devuelve solo datos ficticios y no abre Supabase", async () => {
    jar.token = signVisitorToken(SECRET).token;
    expect(VISITOR_COOKIE).toBe("gdw_visitor");
    const { getSessionLeadRepository } = await import(
      "@/lib/repository/get-repository"
    );
    const repo = await getSessionLeadRepository();
    const leads = await repo.list();
    expect(leads.length).toBeGreaterThanOrEqual(15);
    expect(leads.every((lead) => lead.email?.endsWith("@example.com"))).toBe(
      true,
    );
    expect(leads.every((lead) => lead.id.startsWith("demo-"))).toBe(true);
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
    expect(SupabaseLeadRepository).not.toHaveBeenCalled();
  });

  it("sin cookie sigue pidiendo el cliente de sesión", async () => {
    const { getSessionLeadRepository } = await import(
      "@/lib/repository/get-repository"
    );
    await expect(getSessionLeadRepository()).rejects.toThrow(/session client/);
    expect(createSupabaseServerClient).toHaveBeenCalledOnce();
    expect(SupabaseLeadRepository).not.toHaveBeenCalled();
  });
});
