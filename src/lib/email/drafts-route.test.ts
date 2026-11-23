import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdmin = vi.hoisted(() =>
  vi.fn(async (): Promise<Response | null> => null),
);
const consumeRateLimit = vi.hoisted(() => vi.fn(async () => false));
const createSupabaseServerClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({ requireAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  consumeRateLimit,
}));

import { POST } from "@/app/api/email/drafts/route";

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
  requireAdmin.mockResolvedValue(null);
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

  it("sin Admin no escribe", async () => {
    requireAdmin.mockResolvedValue(new Response("{}", { status: 403 }));
    const res = await POST(post(payload));
    expect(res.status).toBe(403);
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });
});
