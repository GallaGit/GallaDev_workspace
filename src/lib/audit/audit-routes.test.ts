import { beforeEach, describe, expect, it, vi } from "vitest";
import { getApiSession } from "@/lib/api-auth";
import { getSessionLeadRepository } from "@/lib/repository/get-repository";
import { logAudit } from "@/lib/audit/log-audit";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/api-auth", () => ({
  requireApiSession: vi.fn(async () => null),
  requireLeadWriter: vi.fn(async () => null),
  requireAdmin: vi.fn(async () => null),
  getApiSession: vi.fn(),
}));

vi.mock("@/lib/repository/get-repository", () => ({
  getSessionLeadRepository: vi.fn(),
  getActiveProvider: () => "supabase",
}));

vi.mock("@/lib/audit/log-audit", () => ({ logAudit: vi.fn(async () => undefined) }));

vi.mock("@/lib/leads/enforce-lead-write", () => ({
  constrainLeadPatch: vi.fn(async (_repo: unknown, _id: string, patch: unknown) => ({
    ok: true,
    patch,
  })),
  filterReadableLeads: vi.fn(async (leads: unknown[]) => leads),
}));

const seller = { id: "seller-1", email: "seller@x.test", role: "Seller" as const };
const admin = { id: "admin-1", email: "admin@x.test", role: "Admin" as const };

const store: Record<string, Record<string, unknown>> = {};
const repo = {
  get: vi.fn(async (id: string) => store[id] ?? null),
  update: vi.fn(async (id: string, patch: Record<string, unknown>) => {
    store[id] = { ...store[id], ...patch };
    return { id, ...store[id] };
  }),
};

function patchRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const L1 = "11111111-1111-4111-8111-111111111111";
const L2 = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  store[L1] = { id: L1, status: "Nuevo", notes: "nota vieja", responsibleId: "seller-1" };
  store[L2] = { id: L2, status: "Nuevo", notes: null, responsibleId: null };
  vi.mocked(getSessionLeadRepository).mockResolvedValue(repo as never);
  vi.mocked(getApiSession).mockResolvedValue(seller);
});

describe("auditoría de PATCH /api/leads/:id", () => {
  it("cambio de estado: actor de la sesión y antes→después", async () => {
    const { PATCH } = await import("@/app/api/leads/[id]/route");
    const res = await PATCH(
      patchRequest(`http://localhost/api/leads/${L1}`, {
        status: "Validado",
      }),
      { params: Promise.resolve({ id: L1 }) },
    );
    expect(res.status).toBe(200);
    expect(logAudit).toHaveBeenCalledTimes(1);
    expect(logAudit).toHaveBeenCalledWith({
      actor: seller,
      action: "lead.status_changed",
      entity: "lead",
      entityId: L1,
      diff: {
        fields: ["status"],
        changes: { status: { from: "Nuevo", to: "Validado" } },
      },
    });
  });

  it("edición de nota: solo el nombre del campo, sin texto", async () => {
    const { PATCH } = await import("@/app/api/leads/[id]/route");
    await PATCH(patchRequest(`http://localhost/api/leads/${L1}`, { notes: "dato privado nuevo" }), {
      params: Promise.resolve({ id: L1 }),
    });
    const call = vi.mocked(logAudit).mock.calls[0][0];
    expect(call.action).toBe("lead.note_edited");
    expect(call.diff).toEqual({ fields: ["notes"] });
    expect(JSON.stringify(call)).not.toMatch(/privado|vieja/);
  });

  it("reasignación por Admin: guarda responsable anterior y nuevo", async () => {
    vi.mocked(getApiSession).mockResolvedValue(admin);
    const { PATCH } = await import("@/app/api/leads/[id]/route");
    await PATCH(patchRequest(`http://localhost/api/leads/${L1}`, { responsibleId: "seller-2" }), {
      params: Promise.resolve({ id: L1 }),
    });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: admin,
        action: "lead.reassigned",
        diff: {
          fields: ["responsibleId"],
          changes: { responsibleId: { from: "seller-1", to: "seller-2" } },
        },
      }),
    );
  });
});

describe("auditoría de PATCH /api/leads (masivo)", () => {
  it("registra una fila por lead", async () => {
    vi.mocked(getApiSession).mockResolvedValue(admin);
    const { PATCH } = await import("@/app/api/leads/route");
    const res = await PATCH(
      patchRequest("http://localhost/api/leads", { ids: [L1, L2], patch: { status: "Cliente" } }),
    );
    expect(res.status).toBe(200);
    const calls = vi.mocked(logAudit).mock.calls.map((c) => c[0]);
    expect(calls).toHaveLength(2);
    expect(calls.map((c) => c.entityId)).toEqual([L1, L2]);
    expect(calls.every((c) => c.actor === admin && c.action === "lead.status_changed")).toBe(true);
    expect(calls.map((c) => c.diff?.changes?.status)).toEqual([
      { from: "Nuevo", to: "Cliente" },
      { from: "Nuevo", to: "Cliente" },
    ]);
  });
});
