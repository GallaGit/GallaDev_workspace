import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/lib/automations/dispatch", () => ({
  dispatchLeadAnalyzed: vi.fn(),
}));

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
