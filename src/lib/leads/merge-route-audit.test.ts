import { beforeEach, describe, expect, it, vi } from "vitest";

const logLeadMerged = vi.hoisted(() => vi.fn(async () => undefined));
const repo = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
  appendActivity: vi.fn(async () => undefined),
  archive: vi.fn(async () => undefined),
}));

vi.mock("@/lib/audit/events", () => ({ logLeadMerged }));
vi.mock("@/lib/api-auth", () => ({
  requireLeadWriter: vi.fn(async () => null),
  getApiSession: vi.fn(async () => ({ id: "u1", email: "a@b.c", role: "Admin" })),
}));
vi.mock("@/lib/repository/get-repository", () => ({
  getSessionLeadRepository: vi.fn(async () => repo),
}));

function req(body: unknown) {
  return new Request("http://localhost/api/leads/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/leads/merge (auditoría)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.get.mockImplementation(async (id: string) => ({
      id,
      companyName: id,
      archived: false,
      phone: id === "keep" ? "" : "600",
    }));
    repo.update.mockImplementation(async (id: string) => ({ id, companyName: id }));
  });

  it("registra lead.merged con el superviviente y los ids fusionados", async () => {
    const { POST } = await import("@/app/api/leads/merge/route");
    const res = await POST(req({ keepId: "keep", archiveId: "old" }));
    expect(res.status).toBe(200);
    expect(logLeadMerged).toHaveBeenCalledWith({
      keepId: "keep",
      mergedIds: ["old"],
      filledKeys: expect.any(Array),
    });
  });

  it("no registra si el lead no existe", async () => {
    repo.get.mockResolvedValue(null);
    const { POST } = await import("@/app/api/leads/merge/route");
    const res = await POST(req({ keepId: "keep", archiveId: "old" }));
    expect(res.status).toBe(404);
    expect(logLeadMerged).not.toHaveBeenCalled();
  });
});
