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
});
