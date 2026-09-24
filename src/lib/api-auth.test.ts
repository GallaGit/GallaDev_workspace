import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getApiSession,
  requireAdmin,
  requireApiSession,
  requireLeadWriter,
} from "./api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// server.ts usa "server-only" (no resoluble en vitest): se intercepta el
// módulo y cada test inyecta un cliente mock como cliente de servidor.
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

const serverClient = vi.mocked(createSupabaseServerClient);

type MockUser = { id: string; email?: string } | null;

function mockClient(user: MockUser, role: string | null): SupabaseClient {
  return {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: role ? { role } : null,
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("requireApiSession", () => {
  it("permite todo con AUTH_DISABLED=true (dev local, rol Admin)", async () => {
    vi.stubEnv("AUTH_DISABLED", "true");
    expect(await requireApiSession()).toBeNull();
    expect(await getApiSession()).toMatchObject({
      id: "local",
      role: "Admin",
    });
  });

  it("401 sin usuario Supabase", async () => {
    vi.stubEnv("AUTH_DISABLED", "false");
    serverClient.mockResolvedValue(mockClient(null, null));
    const denied = await requireApiSession();
    expect(denied).not.toBeNull();
    expect(denied!.status).toBe(401);
    expect(await denied!.json()).toMatchObject({
      ok: false,
      code: "unauthenticated",
      error: "No autorizado",
    });
  });

  it("401 con usuario pero sin perfil (fail-closed)", async () => {
    vi.stubEnv("AUTH_DISABLED", "false");
    serverClient.mockResolvedValue(
      mockClient({ id: "u1", email: "a@b.c" }, null),
    );
    const denied = await requireApiSession();
    expect(denied).not.toBeNull();
    expect(denied!.status).toBe(401);
    expect(await denied!.json()).toMatchObject({
      ok: false,
      code: "no_profile",
      error:
        "Tu usuario está autenticado pero no tiene un perfil asignado. Contacta al administrador.",
    });
  });

  it("permite con usuario y rol Seller", async () => {
    vi.stubEnv("AUTH_DISABLED", "false");
    const client = mockClient({ id: "u1", email: "a@b.c" }, "Seller");
    serverClient.mockResolvedValue(client);
    expect(await requireApiSession()).toBeNull();
    // getApiSession acepta cliente inyectado (sin pasar por next/headers).
    expect(await getApiSession(client)).toMatchObject({
      id: "u1",
      email: "a@b.c",
      role: "Seller",
    });
  });

  it("401 si el rol del perfil no es Admin, Seller ni Viewer", async () => {
    vi.stubEnv("AUTH_DISABLED", "false");
    serverClient.mockResolvedValue(
      mockClient({ id: "u1", email: "a@b.c" }, "Owner"),
    );
    const denied = await requireApiSession();
    expect(denied!.status).toBe(401);
    expect(await denied!.json()).toMatchObject({ code: "no_profile" });
  });
});

describe("requireApiRole", () => {
  it("Admin pasa requireAdmin y requireLeadWriter", async () => {
    vi.stubEnv("AUTH_DISABLED", "false");
    serverClient.mockResolvedValue(
      mockClient({ id: "admin", email: "admin@b.c" }, "Admin"),
    );
    expect(await requireAdmin()).toBeNull();
    expect(await requireLeadWriter()).toBeNull();
  });

  it("Seller puede escribir leads y no puede administrar", async () => {
    vi.stubEnv("AUTH_DISABLED", "false");
    serverClient.mockResolvedValue(
      mockClient({ id: "seller", email: "s@b.c" }, "Seller"),
    );
    expect(await requireLeadWriter()).toBeNull();
    const denied = await requireAdmin();
    expect(denied!.status).toBe(403);
    expect(await denied!.json()).toMatchObject({
      ok: false,
      code: "forbidden",
      error: "No tienes permiso para realizar esta acción",
    });
  });

  it("Viewer no escribe leads ni administra", async () => {
    vi.stubEnv("AUTH_DISABLED", "false");
    serverClient.mockResolvedValue(
      mockClient({ id: "viewer", email: "v@b.c" }, "Viewer"),
    );
    for (const denied of [await requireAdmin(), await requireLeadWriter()]) {
      expect(denied!.status).toBe(403);
      expect(await denied!.json()).toMatchObject({ code: "forbidden" });
    }
  });

  it("sin sesión sigue siendo 401, no 403", async () => {
    vi.stubEnv("AUTH_DISABLED", "false");
    serverClient.mockResolvedValue(mockClient(null, null));
    const denied = await requireAdmin();
    expect(denied!.status).toBe(401);
    expect(await denied!.json()).toMatchObject({ code: "unauthenticated" });
  });
});
