import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionLeadRepository } from "@/lib/repository/get-repository";
import { runLeadAnalyze } from "@/lib/ai/run-lead-analyze";
import { AI_ANALYZE_RATE_MAX } from "@/lib/ai/require-ai-access";
import { resetRateLimits } from "@/lib/rate-limit";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: () => ({
      select: async () => ({
        data: [{ id: "admin-1", role: "Admin" }],
        error: null,
      }),
    }),
    auth: {
      admin: {
        listUsers: async () => ({
          data: { users: [{ id: "admin-1", email: "admin@b.c" }] },
          error: null,
        }),
      },
    },
  })),
}));

vi.mock("@/lib/repository/get-repository", () => ({
  getSessionLeadRepository: vi.fn(async () => ({ marker: "session" })),
  getLeadRepository: vi.fn(() => {
    throw new Error("service_role repository must not be used");
  }),
  getActiveProvider: () => "supabase",
}));

vi.mock("@/lib/ai/run-lead-analyze", () => ({
  runLeadAnalyze: vi.fn(async () => ({
    ok: true,
    status: 200,
    body: { leadId: "lead-1" },
  })),
}));

const serverClient = vi.mocked(createSupabaseServerClient);
const sessionRepo = vi.mocked(getSessionLeadRepository);
const analyze = vi.mocked(runLeadAnalyze);
const adminClient = vi.mocked(createSupabaseAdminClient);

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

function asRole(role: "Admin" | "Seller" | "Viewer") {
  serverClient.mockResolvedValue(
    mockClient({ id: role.toLowerCase(), email: `${role}@b.c` }, role),
  );
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function expectForbidden(res: Response) {
  expect(res.status).toBe(403);
  expect(await res.json()).toMatchObject({
    ok: false,
    code: "forbidden",
    error: "No tienes permiso para realizar esta acción",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  vi.stubEnv("AUTH_DISABLED", "false");
  vi.stubEnv("NODE_ENV", "test");
});

describe("settings y automatizaciones: solo Admin muta", () => {
  it("Seller y Viewer reciben 403 en PATCH /api/settings", async () => {
    const { PATCH } = await import("@/app/api/settings/route");
    for (const role of ["Seller", "Viewer"] as const) {
      asRole(role);
      const res = await PATCH(
        jsonRequest("http://localhost/api/settings", "PATCH", {
          n8n: { baseUrl: "not-a-url" },
        }),
      );
      await expectForbidden(res);
    }
  });

  it("Admin pasa el gate y la validación responde 400 sin guardar", async () => {
    const { PATCH } = await import("@/app/api/settings/route");
    asRole("Admin");
    const res = await PATCH(
      jsonRequest("http://localhost/api/settings", "PATCH", {
        n8n: { baseUrl: "not-a-url" },
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: "Datos de configuración no válidos",
    });
  });

  it("Seller sigue pudiendo leer settings", async () => {
    const { GET } = await import("@/app/api/settings/route");
    asRole("Seller");
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("Seller y Viewer reciben 403 en POST /api/settings/test", async () => {
    const { POST } = await import("@/app/api/settings/test/route");
    for (const role of ["Seller", "Viewer"] as const) {
      asRole(role);
      const res = await POST(
        jsonRequest("http://localhost/api/settings/test", "POST", {
          integration: "n8n",
        }),
      );
      await expectForbidden(res);
    }
  });

  it("Seller y Viewer reciben 403 al guardar o probar una automatización", async () => {
    const { PATCH, POST } = await import("@/app/api/automations/[action]/route");
    const ctx = { params: Promise.resolve({ action: "lead_created" }) };
    for (const role of ["Seller", "Viewer"] as const) {
      asRole(role);
      await expectForbidden(
        await PATCH(
          jsonRequest("http://localhost/api/automations/lead_created", "PATCH", {
            enabled: true,
          }),
          ctx,
        ),
      );
      asRole(role);
      await expectForbidden(
        await POST(
          jsonRequest("http://localhost/api/automations/lead_created", "POST", {
            test: true,
          }),
          ctx,
        ),
      );
    }
  });
});

describe("escrituras de leads: Viewer denegado", () => {
  it("POST, PATCH masivo, PATCH y DELETE devuelven 403", async () => {
    asRole("Viewer");
    const list = await import("@/app/api/leads/route");
    const item = await import("@/app/api/leads/[id]/route");
    const ctx = { params: Promise.resolve({ id: "lead-1" }) };

    await expectForbidden(
      await list.POST(
        jsonRequest("http://localhost/api/leads", "POST", { companyName: "Acme" }),
      ),
    );
    await expectForbidden(
      await list.PATCH(
        jsonRequest("http://localhost/api/leads", "PATCH", {
          ids: ["lead-1"],
          patch: { favorite: true },
        }),
      ),
    );
    await expectForbidden(
      await item.PATCH(
        jsonRequest("http://localhost/api/leads/lead-1", "PATCH", {
          status: "Nuevo",
        }),
        ctx,
      ),
    );
    await expectForbidden(
      await item.DELETE(new Request("http://localhost/api/leads/lead-1", { method: "DELETE" }), ctx),
    );
    expect(sessionRepo).not.toHaveBeenCalled();
  });

  it("Viewer recibe 403 en merge y score", async () => {
    asRole("Viewer");
    const merge = await import("@/app/api/leads/merge/route");
    const score = await import("@/app/api/leads/score/route");
    await expectForbidden(
      await merge.POST(
        jsonRequest("http://localhost/api/leads/merge", "POST", {
          keepId: "a",
          archiveId: "b",
        }),
      ),
    );
    await expectForbidden(
      await score.POST(
        jsonRequest("http://localhost/api/leads/score", "POST", { ids: ["a"] }),
      ),
    );
    expect(sessionRepo).not.toHaveBeenCalled();
  });

  it("Seller puede iniciar un PATCH (pasa el gate)", async () => {
    asRole("Seller");
    const { PATCH } = await import("@/app/api/leads/[id]/route");
    const res = await PATCH(
      jsonRequest("http://localhost/api/leads/lead-1", "PATCH", {
        notes: "hola",
      }),
      { params: Promise.resolve({ id: "lead-1" }) },
    );
    expect(res.status).not.toBe(403);
    expect(sessionRepo).toHaveBeenCalled();
  });
});

describe("análisis IA", () => {
  it("Viewer recibe 403 y no llama a Groq ni al repositorio", async () => {
    asRole("Viewer");
    const analyzeRoute = await import("@/app/api/leads/[id]/analyze/route");
    const pain = await import("@/app/api/leads/pain-analysis/route");
    await expectForbidden(
      await analyzeRoute.POST(
        jsonRequest("http://localhost/api/leads/lead-1/analyze", "POST", {}),
        { params: Promise.resolve({ id: "lead-1" }) },
      ),
    );
    await expectForbidden(
      await pain.POST(
        jsonRequest("http://localhost/api/leads/pain-analysis", "POST", {
          id: "lead-1",
        }),
      ),
    );
    expect(analyze).not.toHaveBeenCalled();
    expect(sessionRepo).not.toHaveBeenCalled();
  });

  it("Seller analiza con el repositorio de sesión hasta el tope y luego 429", async () => {
    asRole("Seller");
    const { POST } = await import("@/app/api/leads/[id]/analyze/route");
    const ctx = { params: Promise.resolve({ id: "lead-1" }) };

    for (let i = 0; i < AI_ANALYZE_RATE_MAX; i += 1) {
      const res = await POST(
        jsonRequest("http://localhost/api/leads/lead-1/analyze", "POST", {}),
        ctx,
      );
      expect(res.status).toBe(200);
    }

    const blocked = await POST(
      jsonRequest("http://localhost/api/leads/lead-1/analyze", "POST", {}),
      ctx,
    );
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({
      ok: false,
      code: "rate_limited",
      error: "Demasiadas solicitudes. Inténtalo más tarde.",
    });
    expect(analyze).toHaveBeenCalledTimes(AI_ANALYZE_RATE_MAX);
    expect(analyze).toHaveBeenCalledWith(
      "lead-1",
      expect.objectContaining({ repository: { marker: "session" } }),
    );
    expect(sessionRepo).toHaveBeenCalledTimes(AI_ANALYZE_RATE_MAX);
  });

  it("pain-analysis comparte el cupo con analyze", async () => {
    asRole("Seller");
    const analyzeRoute = await import("@/app/api/leads/[id]/analyze/route");
    const pain = await import("@/app/api/leads/pain-analysis/route");
    const ctx = { params: Promise.resolve({ id: "lead-1" }) };

    for (let i = 0; i < AI_ANALYZE_RATE_MAX; i += 1) {
      const res = await analyzeRoute.POST(
        jsonRequest("http://localhost/api/leads/lead-1/analyze", "POST", {}),
        ctx,
      );
      expect(res.status).toBe(200);
    }

    const blocked = await pain.POST(
      jsonRequest("http://localhost/api/leads/pain-analysis", "POST", {
        id: "lead-1",
      }),
    );
    expect(blocked.status).toBe(429);
    expect(analyze).toHaveBeenCalledTimes(AI_ANALYZE_RATE_MAX);
  });
});

describe("GET /api/team", () => {
  it("Seller y Viewer reciben 403 y no usa service_role", async () => {
    const { GET } = await import("@/app/api/team/route");
    for (const role of ["Seller", "Viewer"] as const) {
      asRole(role);
      await expectForbidden(await GET());
    }
    expect(adminClient).not.toHaveBeenCalled();
  });

  it("Admin lista el equipo", async () => {
    asRole("Admin");
    const { GET } = await import("@/app/api/team/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      members: [{ id: "admin-1", email: "admin@b.c", role: "Admin" }],
    });
    expect(adminClient).toHaveBeenCalledOnce();
  });
});

describe("GET /api/session", () => {
  it("devuelve el rol del usuario autenticado", async () => {
    asRole("Viewer");
    const { GET } = await import("@/app/api/session/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: "viewer",
      role: "Viewer",
    });
  });
});
