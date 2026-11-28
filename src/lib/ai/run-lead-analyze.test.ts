import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeBusinessPains } from "@/lib/ai/analyze-lead-pains";

vi.mock("server-only", () => ({}));

const { getSessionLeadRepository, getLeadRepository } = vi.hoisted(() => ({
  getSessionLeadRepository: vi.fn(),
  getLeadRepository: vi.fn(),
}));

vi.mock("@/lib/repository/get-repository", () => ({
  getSessionLeadRepository,
  getLeadRepository,
}));

vi.mock("@/lib/ai/analyze-lead-pains", () => ({
  analyzeBusinessPains: vi.fn(),
  PainAnalysisError: class PainAnalysisError extends Error {
    code = "invalid";
  },
}));

vi.mock("@/lib/api-auth", () => ({
  getApiSession: vi.fn(async () => ({ id: "u1", email: "a@b.c", role: "Admin" })),
}));

const logLeadAiAnalyzed = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/lib/audit/events", () => ({ logLeadAiAnalyzed }));

vi.mock("@/lib/settings/service", () => ({
  getSettingsService: () => ({
    getRaw: () => ({ ai: { model: { value: "test-model" } } }),
  }),
}));

describe("runLeadAnalyze repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("usa el repositorio de sesión y no el singleton service_role", async () => {
    const get = vi.fn(async () => null);
    getSessionLeadRepository.mockResolvedValue({ get });

    const { runLeadAnalyze } = await import("./run-lead-analyze");
    const result = await runLeadAnalyze("lead-1");

    expect(getSessionLeadRepository).toHaveBeenCalledOnce();
    expect(getLeadRepository).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledWith("lead-1");
    expect(result).toMatchObject({
      ok: false,
      status: 404,
      body: { error: "Lead no encontrado" },
    });
  });

  it("respeta el repositorio inyectado", async () => {
    const get = vi.fn(async () => null);
    const { runLeadAnalyze } = await import("./run-lead-analyze");
    await runLeadAnalyze("lead-2", { repository: { get } as never });

    expect(getSessionLeadRepository).not.toHaveBeenCalled();
    expect(getLeadRepository).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledWith("lead-2");
  });

  it("registra el catch de lectura sin el mensaje ni el contacto", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const leaked = "supabase down token-secreto user@example.com";
    const get = vi.fn(async () => {
      throw new Error(leaked);
    });
    try {
      const { runLeadAnalyze } = await import("./run-lead-analyze");
      const result = await runLeadAnalyze("lead-9", {
        repository: { get } as never,
        route: "POST /api/leads/:id/analyze",
        requestId: "req-analyze-1",
      });
      expect(result).toMatchObject({ ok: false, status: 500 });
      const dumped = spy.mock.calls
        .flat()
        .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
        .join("\n");
      expect(dumped).not.toContain("token-secreto");
      expect(dumped).not.toContain("user@example.com");
      const line = spy.mock.calls
        .map((call) => call[0])
        .find((part) => typeof part === "string");
      expect(JSON.parse(String(line))).toEqual({
        level: "error",
        route: "POST /api/leads/:id/analyze",
        status: 500,
        errorClass: "Error",
        requestId: "req-analyze-1",
        leadId: "lead-9",
      });
    } finally {
      spy.mockRestore();
    }
  });
});

describe("runLeadAnalyze auditoría (lead.ai_analyzed)", () => {
  const lead = { id: "lead-7", companyName: "Acme", responsibleId: "u1" };
  const repository = {
    get: vi.fn(async () => lead),
    update: vi.fn(async () => lead),
    getActivity: vi.fn(async () => []),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("éxito: registra modelo y success=true", async () => {
    vi.mocked(analyzeBusinessPains).mockResolvedValue({
      evidence: ["a"],
      inference: [],
      speculation: [],
    });
    const { runLeadAnalyze } = await import("./run-lead-analyze");
    const result = await runLeadAnalyze("lead-7", { force: true, repository: repository as never });
    expect(result.ok).toBe(true);
    expect(logLeadAiAnalyzed).toHaveBeenCalledWith({
      leadId: "lead-7",
      model: "test-model",
      success: true,
    });
  });

  it("fallo del proveedor: registra success=false sin el mensaje", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(analyzeBusinessPains).mockRejectedValue(new Error("boom"));
    const { runLeadAnalyze } = await import("./run-lead-analyze");
    const result = await runLeadAnalyze("lead-7", { force: true, repository: repository as never });
    expect(result).toMatchObject({ ok: false, status: 502 });
    expect(logLeadAiAnalyzed).toHaveBeenCalledWith({
      leadId: "lead-7",
      model: "test-model",
      success: false,
    });
    spy.mockRestore();
  });
});
