import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const insertMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: () => ({ insert: insertMock }),
  })),
}));

const isVisitorRequestMock = vi.fn();
vi.mock("@/lib/demo/visitor-request", () => ({
  isVisitorRequest: (...args: unknown[]) => isVisitorRequestMock(...args),
}));

const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const actor = { id: "u1", email: "ana@example.com", role: "Seller" as const };

describe("logAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AUTH_DISABLED", "false");
    vi.stubEnv("NODE_ENV", "test");
    isVisitorRequestMock.mockResolvedValue(false);
    insertMock.mockResolvedValue({ error: null });
  });

  it("escribe con el actor de la sesión y el rol del momento", async () => {
    const { logAudit } = await import("./log-audit");
    await logAudit({
      actor,
      action: "lead.created",
      entity: "lead",
      entityId: LEAD_ID,
      changedFields: ["name", "email", "name"],
    });

    expect(insertMock).toHaveBeenCalledWith({
      actor_id: "u1",
      actor_email: "ana@example.com",
      actor_role: "Seller",
      action: "lead.created",
      entity: "lead",
      entity_id: LEAD_ID,
      lead_id: LEAD_ID,
      diff: { fields: ["email", "name"] },
    });
  });

  it("no rellena lead_id fuera de leads", async () => {
    const { logAudit } = await import("./log-audit");
    await logAudit({
      actor,
      action: "settings.changed",
      entity: "settings",
      entityId: "workspace",
    });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ lead_id: null, diff: { fields: [] } }),
    );
  });

  it("traga errores de inserción y excepciones", async () => {
    insertMock.mockResolvedValueOnce({ error: { message: "fail" } });
    const { logAudit } = await import("./log-audit");
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(
      logAudit({ actor, action: "lead.updated", entity: "lead", entityId: LEAD_ID }),
    ).resolves.toBeUndefined();

    insertMock.mockRejectedValueOnce(new Error("boom"));
    await expect(
      logAudit({ actor, action: "lead.archived", entity: "lead", entityId: LEAD_ID }),
    ).resolves.toBeUndefined();
    spy.mockRestore();
  });

  it("no registra para visitante ni con AUTH_DISABLED", async () => {
    const { logAudit } = await import("./log-audit");

    isVisitorRequestMock.mockResolvedValueOnce(true);
    await logAudit({ actor, action: "lead.created", entity: "lead", entityId: LEAD_ID });
    expect(insertMock).not.toHaveBeenCalled();

    vi.stubEnv("AUTH_DISABLED", "true");
    await logAudit({
      actor,
      action: "team.role_changed",
      entity: "profile",
      entityId: "u2",
      changedFields: ["role"],
    });
    expect(insertMock).not.toHaveBeenCalled();
  });
});
