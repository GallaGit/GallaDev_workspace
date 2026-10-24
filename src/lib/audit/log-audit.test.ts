import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const insertMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: () => ({
      insert: insertMock,
    }),
  })),
}));

const isVisitorRequestMock = vi.fn();
vi.mock("@/lib/demo/visitor-request", () => ({
  isVisitorRequest: (...args: unknown[]) => isVisitorRequestMock(...args),
}));

describe("logAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AUTH_DISABLED", "false");
    isVisitorRequestMock.mockResolvedValue(false);
    insertMock.mockResolvedValue({ error: null });
  });

  it("inserts correct row", async () => {
    const { logAudit } = await import("./log-audit");
    await logAudit({
      actorId: "u1",
      action: "create",
      entity: "lead",
      entityId: "l1",
      diff: { after: { name: "Acme" } },
    });

    expect(insertMock).toHaveBeenCalledWith({
      actor_id: "u1",
      action: "create",
      entity: "lead",
      entity_id: "l1",
      diff: { after: { name: "Acme" } },
    });
  });

  it("swallows insert errors and thrown errors", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce({
      from: () => ({
        insert: vi.fn().mockResolvedValue({ error: { message: "fail" } }),
      }),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const { logAudit } = await import("./log-audit");
    await expect(
      logAudit({
        actorId: "u1",
        action: "update",
        entity: "lead",
        entityId: "l1",
      }),
    ).resolves.toBeUndefined();

    vi.mocked(createSupabaseServerClient).mockRejectedValueOnce(new Error("boom"));
    await expect(
      logAudit({
        actorId: "u1",
        action: "delete",
        entity: "lead",
        entityId: "l1",
      }),
    ).resolves.toBeUndefined();
  });

  it("skips for visitor and AUTH_DISABLED", async () => {
    const { logAudit } = await import("./log-audit");

    isVisitorRequestMock.mockResolvedValueOnce(true);
    await logAudit({
      actorId: "u1",
      action: "create",
      entity: "lead",
      entityId: "l1",
    });
    expect(insertMock).not.toHaveBeenCalled();

    isVisitorRequestMock.mockResolvedValueOnce(false);
    vi.stubEnv("AUTH_DISABLED", "true");
    await logAudit({
      actorId: "u1",
      action: "role_change",
      entity: "profile",
      entityId: "u2",
      diff: { role: "Admin" },
    });
    expect(insertMock).not.toHaveBeenCalled();
  });
});
