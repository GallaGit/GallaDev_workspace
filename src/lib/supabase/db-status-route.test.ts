import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbStatusMessage } from "./health";

const requireApiSession = vi.hoisted(() => vi.fn(async () => null));
const createSupabaseServerClient = vi.hoisted(() => vi.fn());
const abortSignal = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({
  requireApiSession,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient,
}));

beforeEach(() => {
  requireApiSession.mockReset();
  requireApiSession.mockResolvedValue(null);
  abortSignal.mockReset();
  createSupabaseServerClient.mockReset();
  createSupabaseServerClient.mockResolvedValue({
    from: (table: string) => {
      if (table !== "leads") throw new Error(table);
      return { select: () => ({ abortSignal }) };
    },
  });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-test");
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubEnv("SUPABASE_SECRET_KEY", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
});

describe("GET /api/db-status", () => {
  it("cuenta con el cliente de sesión y un texto fijo", async () => {
    abortSignal.mockResolvedValue({ error: null, count: 4 });
    const { GET } = await import("@/app/api/db-status/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      provider: "supabase",
      status: "ok",
      message: dbStatusMessage("ok"),
    });
    expect(createSupabaseServerClient).toHaveBeenCalledOnce();
  });

  it("no devuelve el mensaje de Postgres", async () => {
    abortSignal.mockResolvedValue({
      error: {
        code: "42P01",
        message: "relation \"secret_table\" does not exist",
      },
    });
    const { GET } = await import("@/app/api/db-status/route");
    const body = await (await GET()).json();
    expect(body.status).toBe("config");
    expect(body.message).toBe(dbStatusMessage("config"));
    expect(JSON.stringify(body)).not.toMatch(/secret_table|relation/i);
  });

  it("marca config si faltan la URL o la clave publicable, sin service role", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_URL", "");
    const { GET } = await import("@/app/api/db-status/route");
    const body = await (await GET()).json();
    expect(body.status).toBe("config");
    expect(body.message).toBe(dbStatusMessage("config"));
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });
});
