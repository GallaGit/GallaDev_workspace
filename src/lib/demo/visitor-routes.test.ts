import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signVisitorToken } from "./token";
import { resetRateLimits } from "@/lib/rate-limit";

const jar = vi.hoisted(() => ({ token: undefined as string | undefined }));
const createSupabaseServerClient = vi.hoisted(() => vi.fn());
const createSupabaseAdminClient = vi.hoisted(() => vi.fn());
const SupabaseLeadRepository = vi.hoisted(() =>
  vi.fn(function SupabaseLeadRepository() {
    throw new Error("SupabaseLeadRepository");
  }),
);
const runLeadAnalyze = vi.hoisted(() => vi.fn());
const analyzeBusinessPains = vi.hoisted(() => vi.fn());
const sendIngestEmails = vi.hoisted(() => vi.fn());

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

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient,
}));

vi.mock("@/lib/supabase/supabase-lead-repository", () => ({
  SupabaseLeadRepository,
}));

vi.mock("@/lib/ai/run-lead-analyze", () => ({
  runLeadAnalyze,
}));

vi.mock("@/lib/ai/analyze-lead-pains", () => ({
  analyzeBusinessPains,
  PainAnalysisError: class PainAnalysisError extends Error {},
}));

vi.mock("@/lib/email/send-ingest-emails", () => ({
  sendIngestEmails,
}));

const SECRET = "demo-session-secret-test";

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function expectDemoForbidden(res: Response) {
  expect(res.status).toBe(403);
  expect(await res.json()).toMatchObject({
    ok: false,
    code: "demo_readonly",
  });
}

beforeEach(() => {
  jar.token = signVisitorToken(SECRET).token;
  resetRateLimits();
  createSupabaseServerClient.mockReset();
  createSupabaseServerClient.mockImplementation(async () => {
    throw new Error("session client");
  });
  createSupabaseAdminClient.mockReset();
  createSupabaseAdminClient.mockImplementation(() => {
    throw new Error("admin client");
  });
  SupabaseLeadRepository.mockClear();
  runLeadAnalyze.mockReset();
  analyzeBusinessPains.mockReset();
  sendIngestEmails.mockReset();
  vi.stubEnv("DEMO_MODE_ENABLED", "true");
  vi.stubEnv("DEMO_SESSION_SECRET", SECRET);
  vi.stubEnv("AUTH_DISABLED", "false");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("INGEST_SECRET", "test-ingest-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("rutas bloqueadas para el visitante", () => {
  it("GET /api/team, settings y automations responden 403 sin service role", async () => {
    const team = await import("@/app/api/team/route");
    const settings = await import("@/app/api/settings/route");
    const automations = await import("@/app/api/automations/route");
    const dbStatus = await import("@/app/api/db-status/route");
    await expectDemoForbidden(await team.GET());
    await expectDemoForbidden(await dbStatus.GET());
    await expectDemoForbidden(await settings.GET());
    await expectDemoForbidden(
      await settings.PATCH(
        jsonRequest("http://localhost/api/settings", "PATCH", {}),
      ),
    );
    await expectDemoForbidden(await automations.GET());
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
    expect(SupabaseLeadRepository).not.toHaveBeenCalled();
  });

  it("el análisis real y la ingesta responden 403 sin modelo, correo ni repositorio", async () => {
    const analyze = await import("@/app/api/leads/[id]/analyze/route");
    const pain = await import("@/app/api/leads/pain-analysis/route");
    const ingest = await import("@/app/api/ingest/lead/route");
    const n8n = await import("@/app/api/ingest/n8n/route");
    await expectDemoForbidden(
      await analyze.POST(
        jsonRequest("http://localhost/api/leads/demo-01/analyze", "POST", {}),
        { params: Promise.resolve({ id: "demo-01" }) },
      ),
    );
    await expectDemoForbidden(
      await pain.POST(
        jsonRequest("http://localhost/api/leads/pain-analysis", "POST", {
          id: "demo-01",
        }),
      ),
    );
    await expectDemoForbidden(
      await ingest.POST(
        jsonRequest("http://localhost/api/ingest/lead", "POST", {
          name: "Ana",
          email: "ana@example.com",
          company: "Acme",
          message: "hola",
        }),
      ),
    );
    await expectDemoForbidden(
      await n8n.POST(
        jsonRequest("http://localhost/api/ingest/n8n", "POST", {
          companyName: "Acme",
        }),
      ),
    );
    expect(runLeadAnalyze).not.toHaveBeenCalled();
    expect(analyzeBusinessPains).not.toHaveBeenCalled();
    expect(sendIngestEmails).not.toHaveBeenCalled();
    expect(SupabaseLeadRepository).not.toHaveBeenCalled();
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("un PATCH de lead responde 403 y no construye el repositorio de Supabase", async () => {
    const item = await import("@/app/api/leads/[id]/route");
    await expectDemoForbidden(
      await item.PATCH(
        jsonRequest("http://localhost/api/leads/demo-01", "PATCH", {
          status: "Cliente",
        }),
        { params: Promise.resolve({ id: "demo-01" }) },
      ),
    );
    expect(SupabaseLeadRepository).not.toHaveBeenCalled();
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("sync y el detalle leen la demo, no Supabase", async () => {
    const sync = await import("@/app/api/sync/route");
    const item = await import("@/app/api/leads/[id]/route");
    const synced = await sync.POST();
    expect(synced.status).toBe(200);
    const body = (await synced.json()) as {
      provider: string;
      leads: { id: string; email: string | null; aiAnalysis: string | null }[];
    };
    expect(body.provider).toBe("demo");
    expect(body.leads.every((lead) => lead.email?.endsWith("@example.com"))).toBe(
      true,
    );
    const detail = await item.GET(new Request("http://localhost/api/leads/demo-03"), {
      params: Promise.resolve({ id: "demo-03" }),
    });
    expect(detail.status).toBe(200);
    const detailBody = (await detail.json()) as {
      lead: { aiAnalysis: string | null; companyName: string };
    };
    expect(detailBody.lead.companyName).toContain("Ejemplo");
    expect(detailBody.lead.aiAnalysis).toMatch(/Evidencia/);
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
    expect(SupabaseLeadRepository).not.toHaveBeenCalled();
  });
});
