import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const logAudit = vi.hoisted(() => vi.fn(async () => undefined));
const getApiSession = vi.hoisted(() =>
  vi.fn(async (): Promise<unknown> => ({ id: "u1", email: "a@b.c", role: "Admin" })),
);

vi.mock("./log-audit", () => ({
  logAudit,
  AUDIT_SYSTEM_ACTOR: { id: null, email: null, role: null },
}));
vi.mock("@/lib/api-auth", () => ({ getApiSession }));

import {
  auditSubject,
  logEmailReceived,
  logEmailReplied,
  logEmailThreadChange,
  logLeadAiAnalyzed,
  logLeadMerged,
} from "./events";

const T = "ed07cdd4-c542-4f9a-8b8e-bd73e358c6cd";
const L = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
  getApiSession.mockResolvedValue({ id: "u1", email: "a@b.c", role: "Admin" });
});

describe("auditSubject", () => {
  it("trunca a 80 caracteres y vacío es null", () => {
    expect(auditSubject("x".repeat(200))).toHaveLength(80);
    expect(auditSubject("  ")).toBeNull();
    expect(auditSubject(undefined)).toBeNull();
  });
});

describe("email.received", () => {
  it("actor sistema, solo ids, asunto truncado y nº de adjuntos", async () => {
    await logEmailReceived({
      threadId: T,
      messageId: "m1",
      subject: "s".repeat(200),
      attachmentCount: 2,
    });
    const call = logAudit.mock.calls[0] as unknown as [{ diff: { meta: Record<string, unknown> } } & Record<string, unknown>];
    expect(call[0]).toMatchObject({
      actor: { id: null, email: null, role: null },
      action: "email.received",
      entity: "email_thread",
      entityId: T,
    });
    expect(call[0].diff.meta.subject).toHaveLength(80);
    expect(call[0].diff.meta.attachments).toBe(2);
    expect(JSON.stringify(call[0])).not.toMatch(/@example|body/);
  });
});

describe("email.replied", () => {
  it("actor de sesión, lead_id del hilo y contadores", async () => {
    await logEmailReplied({ threadId: T, messageId: "m2", leadId: L, attachmentCount: 1 });
    expect(logAudit).toHaveBeenCalledWith({
      actor: { id: "u1", email: "a@b.c", role: "Admin" },
      action: "email.replied",
      entity: "email_thread",
      entityId: T,
      leadId: L,
      diff: { fields: [], meta: { messageId: "m2", attachments: 1 } },
    });
  });

  it("sin sesión no registra", async () => {
    getApiSession.mockResolvedValue(null);
    await logEmailReplied({ threadId: T, attachmentCount: 0 });
    expect(logAudit).not.toHaveBeenCalled();
  });
});

describe("email.linked / email.archived", () => {
  it("vincular informa lead_id nuevo", async () => {
    await logEmailThreadChange([T], { lead_id: L });
    expect(logAudit).toHaveBeenCalledTimes(1);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "email.linked",
        entityId: T,
        leadId: L,
        diff: { fields: ["lead_id"], meta: { linked: true } },
      }),
    );
  });

  it("desvincular conserva el lead_id del hilo", async () => {
    await logEmailThreadChange([T], { lead_id: null }, L);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: L, diff: { fields: ["lead_id"], meta: { linked: false } } }),
    );
  });

  it("archivar y papelera: una fila por hilo", async () => {
    await logEmailThreadChange([T, "t2"], { archived: true });
    expect(logAudit).toHaveBeenCalledTimes(2);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "email.archived",
        diff: { fields: ["archived"], meta: { state: "archived" } },
      }),
    );
    logAudit.mockClear();
    await logEmailThreadChange([T], { trashed: true });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ diff: { fields: ["trashed"], meta: { state: "trashed" } } }),
    );
  });

  it("solo is_read no genera evento", async () => {
    await logEmailThreadChange([T], { is_read: true });
    expect(logAudit).not.toHaveBeenCalled();
  });
});

describe("lead.merged", () => {
  it("lead superviviente y ids fusionados en meta", async () => {
    await logLeadMerged({ keepId: L, mergedIds: ["old"], filledKeys: ["phone", "email"] });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "lead.merged",
        entity: "lead",
        entityId: L,
        diff: { fields: ["email", "phone"], meta: { mergedIds: ["old"] } },
      }),
    );
  });
});

describe("lead.ai_analyzed", () => {
  it("modelo y resultado, sin prompt ni salida", async () => {
    await logLeadAiAnalyzed({ leadId: L, model: "m", success: false });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "lead.ai_analyzed",
        entityId: L,
        diff: { fields: [], meta: { model: "m", success: false } },
      }),
    );
  });
});
