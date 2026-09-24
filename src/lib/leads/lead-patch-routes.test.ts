import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireApiSession } from "@/lib/api-auth";
import { getSessionLeadRepository } from "@/lib/repository/get-repository";
import { dispatchLeadUpdated } from "@/lib/automations/dispatch";

vi.mock("@/lib/api-auth", () => ({
  requireApiSession: vi.fn(async () => null),
}));

vi.mock("@/lib/repository/get-repository", () => ({
  getSessionLeadRepository: vi.fn(),
}));

vi.mock("@/lib/automations/dispatch", () => ({
  changedKeys: (patch: object) => Object.keys(patch),
  dispatchLeadUpdated: vi.fn(() => ({ status: "skipped", reason: "inactive" })),
  summarizeDispatch: (results: { status: string }[]) => ({
    dispatched: results.filter((result) => result.status === "dispatched").length,
    skipped: results.filter((result) => result.status !== "dispatched").length,
  }),
}));

const update = vi.fn(async (id: string, patch: Record<string, unknown>) => ({
  id,
  companyName: "Acme",
  status: "Nuevo",
  ...patch,
}));

function jsonRequest(url: string, body: string) {
  return new Request(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("PATCH /api/leads/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireApiSession).mockResolvedValue(null);
    update.mockClear();
    vi.mocked(getSessionLeadRepository).mockResolvedValue({
      update,
    } as never);
  });

  it("updates the lead when the patch is valid", async () => {
    const { PATCH } = await import("@/app/api/leads/[id]/route");
    const res = await PATCH(jsonRequest("http://localhost/api/leads/lead-1", JSON.stringify({
      status: "Email preparado",
      notes: "Listo",
    })), { params: Promise.resolve({ id: "lead-1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lead.status).toBe("Email preparado");
    expect(update).toHaveBeenCalledWith("lead-1", {
      status: "Email preparado",
      notes: "Listo",
    });
    expect(dispatchLeadUpdated).toHaveBeenCalled();
  });

  it("returns 400 with field errors for invalid fields and types", async () => {
    const { PATCH } = await import("@/app/api/leads/[id]/route");
    const res = await PATCH(jsonRequest("http://localhost/api/leads/lead-1", JSON.stringify({
      status: "Inventado",
      employees: "diez",
      archived: true,
    })), { params: Promise.resolve({ id: "lead-1" }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Datos del lead no válidos");
    expect(body.fieldErrors.status).toMatch(/estado/i);
    expect(body.fieldErrors.employees).toBeTruthy();
    expect(body.fieldErrors.archived).toBe("Campo no permitido");
    expect(update).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const { PATCH } = await import("@/app/api/leads/[id]/route");
    const res = await PATCH(
      jsonRequest("http://localhost/api/leads/lead-1", "{"),
      { params: Promise.resolve({ id: "lead-1" }) },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "JSON no válido" });
    expect(update).not.toHaveBeenCalled();
  });

  it("returns 400 for an empty body", async () => {
    const { PATCH } = await import("@/app/api/leads/[id]/route");
    const res = await PATCH(
      jsonRequest("http://localhost/api/leads/lead-1", ""),
      { params: Promise.resolve({ id: "lead-1" }) },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "JSON no válido" });
  });
});

describe("PATCH /api/leads bulk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireApiSession).mockResolvedValue(null);
    update.mockClear();
    vi.mocked(getSessionLeadRepository).mockResolvedValue({
      update,
    } as never);
  });

  it("updates each id when the bulk patch is valid", async () => {
    const { PATCH } = await import("@/app/api/leads/route");
    const res = await PATCH(jsonRequest("http://localhost/api/leads", JSON.stringify({
      ids: ["a", "b"],
      patch: { favorite: true },
    })));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.leads).toHaveLength(2);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith("a", { favorite: true });
    expect(update).toHaveBeenCalledWith("b", { favorite: true });
  });

  it("returns 400 when the patch fields are invalid", async () => {
    const { PATCH } = await import("@/app/api/leads/route");
    const res = await PATCH(jsonRequest("http://localhost/api/leads", JSON.stringify({
      ids: ["a"],
      patch: { status: "Nope" },
    })));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Datos del lead no válidos");
    expect(body.fieldErrors["patch.status"]).toMatch(/estado/i);
    expect(update).not.toHaveBeenCalled();
  });

  it("keeps the required message when ids and patch are missing", async () => {
    const { PATCH } = await import("@/app/api/leads/route");
    const res = await PATCH(jsonRequest("http://localhost/api/leads", "{}"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("ids y patch requeridos");
    expect(body.fieldErrors.ids).toBeTruthy();
    expect(body.fieldErrors.patch).toBeTruthy();
  });

  it("returns 400 for malformed JSON", async () => {
    const { PATCH } = await import("@/app/api/leads/route");
    const res = await PATCH(jsonRequest("http://localhost/api/leads", "not-json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Payload no válido o demasiado grande",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("returns 400 for an empty body", async () => {
    const { PATCH } = await import("@/app/api/leads/route");
    const res = await PATCH(jsonRequest("http://localhost/api/leads", ""));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("ids y patch requeridos");
  });
});
