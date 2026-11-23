import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCorreoAccess = vi.hoisted(() =>
  vi.fn(async (): Promise<Response | null> => null),
);
const consumeRateLimit = vi.hoisted(() => vi.fn(async () => false));
const createSupabaseServerClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({ requireCorreoAccess }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  consumeRateLimit,
}));

import { GET, POST } from "@/app/api/email/drafts/route";

const DRAFT = "11111111-1111-4111-8111-111111111111";

function post(body: unknown): Request {
  return new Request("http://localhost/api/email/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function fakeClient() {
  const insert = vi.fn();
  const update = vi.fn();
  const row = { id: DRAFT, cc_address: "a@example.com", bcc_address: "b@example.com" };
  const single = async () => ({ data: row, error: null });
  insert.mockReturnValue({ select: () => ({ single }) });
  update.mockReturnValue({ eq: () => ({ select: () => ({ single }) }) });
  createSupabaseServerClient.mockResolvedValue({ from: () => ({ insert, update }) });
  return { insert, update };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireCorreoAccess.mockResolvedValue(null);
  consumeRateLimit.mockResolvedValue(false);
});

describe("POST /api/email/drafts con Cc/Cco", () => {
  const payload = {
    mailbox: "hola@galladev.com",
    to: "cliente@example.com",
    cc: "a@example.com",
    bcc: "b@example.com",
    subject: "S",
    bodyText: "B",
    leadId: null,
  };

  it("crea el borrador guardando cc_address y bcc_address", async () => {
    const { insert } = fakeClient();
    const res = await POST(post(payload));
    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ cc_address: "a@example.com", bcc_address: "b@example.com" }),
    );
  });

  it("al actualizar sin Cc/Cco los vacía", async () => {
    const { update } = fakeClient();
    const { cc: _cc, bcc: _bcc, ...rest } = payload;
    void _cc;
    void _bcc;
    const res = await POST(post({ ...rest, id: DRAFT }));
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ cc_address: "", bcc_address: "" }),
    );
  });

  it("sin acceso al buzón no escribe", async () => {
    requireCorreoAccess.mockResolvedValue(new Response("{}", { status: 403 }));
    const res = await POST(post(payload));
    expect(res.status).toBe(403);
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });
});


const LEAD = "22222222-2222-4222-8222-222222222222";

function thenableClient(options: {
  existingId?: string | null;
  insertId?: string;
}) {
  const inserted: unknown[] = [];
  const updated: unknown[] = [];
  const row = {
    id: options.existingId ?? options.insertId ?? DRAFT,
    lead_id: LEAD,
    subject: "S",
    body_text: "B",
  };
  const result = { data: options.existingId ? [ { id: options.existingId } ] : [], error: null };
  const singleResult = { data: row, error: null };
  const api: Record<string, unknown> = {};
  const self = () => api;
  api.select = vi.fn(self);
  api.eq = vi.fn(self);
  api.is = vi.fn(self);
  api.order = vi.fn(self);
  api.limit = vi.fn(self);
  api.maybeSingle = vi.fn(async () => ({
    data: options.existingId ? { id: options.existingId } : null,
    error: null,
  }));
  api.single = vi.fn(async () => singleResult);
  api.insert = vi.fn((row: unknown) => {
    inserted.push(row);
    return api;
  });
  api.update = vi.fn((row: unknown) => {
    updated.push(row);
    return api;
  });
  api.then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  createSupabaseServerClient.mockResolvedValue({ from: () => api });
  return { api, inserted, updated, result };
}

describe("POST /api/email/drafts upsertByLead y lead_id", () => {
  const payload = {
    upsertByLead: true,
    mailbox: "hola@galladev.com",
    to: "lead@example.com",
    subject: "Asunto",
    bodyText: "Cuerpo",
    leadId: LEAD,
  };

  it("crea un borrador de mensaje nuevo si el lead no tenía uno", async () => {
    const { inserted, updated } = thenableClient({ insertId: DRAFT });
    const res = await POST(post(payload));
    expect(res.status).toBe(201);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toEqual(
      expect.objectContaining({
        mailbox_address: "hola@galladev.com",
        to_address: "lead@example.com",
        subject: "Asunto",
        body_text: "Cuerpo",
        lead_id: LEAD,
      }),
    );
    expect(updated).toHaveLength(0);
  });

  it("actualiza el borrador existente del lead sin pisar mailbox ni copias", async () => {
    const { inserted, updated } = thenableClient({ existingId: DRAFT });
    const res = await POST(post(payload));
    expect(res.status).toBe(200);
    expect(inserted).toHaveLength(0);
    expect(updated).toHaveLength(1);
    expect(updated[0]).toEqual({
      to_address: "lead@example.com",
      subject: "Asunto",
      body_text: "Cuerpo",
      lead_id: LEAD,
    });
    expect(updated[0]).not.toHaveProperty("mailbox_address");
    expect(updated[0]).not.toHaveProperty("cc_address");
  });

  it("al actualizar sin leadId no envía lead_id (conserva el vínculo)", async () => {
    const { update } = fakeClient();
    const res = await POST(
      post({
        id: DRAFT,
        mailbox: "hola@galladev.com",
        to: "cliente@example.com",
        subject: "S",
        bodyText: "B",
      }),
    );
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.not.objectContaining({ lead_id: expect.anything() }),
    );
    const row = update.mock.calls[0][0] as Record<string, unknown>;
    expect(row).not.toHaveProperty("lead_id");
  });
});

describe("GET /api/email/drafts?leadId=", () => {
  it("devuelve el borrador de mensaje nuevo de ese lead", async () => {
    const draft = { id: DRAFT, lead_id: LEAD, subject: "S", body_text: "B" };
    const { api } = thenableClient({ existingId: DRAFT });
    // The GET awaits .limit() which is thenable via api.then — override result data
    (api as { then: unknown }).then = (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: [draft], error: null }).then(resolve, reject);
    const res = await GET(
      new Request(`http://localhost/api/email/drafts?leadId=${LEAD}`),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, draft });
  });

  it("rechaza un leadId que no es UUID", async () => {
    const res = await GET(new Request("http://localhost/api/email/drafts?leadId=nope"));
    expect(res.status).toBe(400);
  });
});
