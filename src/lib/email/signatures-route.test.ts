import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdmin = vi.hoisted(() =>
  vi.fn(async (): Promise<Response | null> => null),
);
const requireCorreoAccess = vi.hoisted(() =>
  vi.fn(async (): Promise<Response | null> => null),
);
const getApiSession = vi.hoisted(() =>
  vi.fn(async () => ({
    id: "ed07cdd4-c542-4f9a-8b8e-bd73e358c6cd",
    email: "a@b.c",
    role: "Admin",
  })),
);
const createSupabaseServerClient = vi.hoisted(() => vi.fn());
const consumeRateLimit = vi.hoisted(() => vi.fn(async () => false));

vi.mock("@/lib/api-auth", () => ({ requireAdmin, requireCorreoAccess, getApiSession }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  consumeRateLimit,
}));

import { GET, PUT } from "@/app/api/email/signatures/route";

function putRequest(body: unknown): Request {
  return new Request("http://localhost/api/email/signatures", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function selectClient(result: { data?: unknown; error?: { code: string } | null }) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(async () => ({ data: result.data ?? [], error: result.error ?? null })),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue(null);
  requireCorreoAccess.mockResolvedValue(null);
  consumeRateLimit.mockResolvedValue(false);
});

describe("GET /api/email/signatures", () => {
  it("sin acceso al buzón devuelve la denegación y no abre Supabase", async () => {
    requireCorreoAccess.mockResolvedValue(
      new Response(JSON.stringify({ ok: false }), { status: 403 }),
    );
    const res = await GET(new Request("http://localhost/api/email/signatures"));
    expect(res.status).toBe(403);
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("devuelve una firma por buzón, vacía si no hay fila, e ignora buzones ajenos", async () => {
    createSupabaseServerClient.mockResolvedValue(
      selectClient({
        data: [
          { mailbox_address: "ociel@galladev.com", signature: "Ociel" },
          { mailbox_address: "otro@galladev.com", signature: "no" },
        ],
      }),
    );
    const res = await GET(new Request("http://localhost/api/email/signatures"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      signatures: { "hola@galladev.com": "", "ociel@galladev.com": "Ociel" },
    });
  });

  it("error de base de datos responde 500 con JSON", async () => {
    createSupabaseServerClient.mockResolvedValue(selectClient({ error: { code: "42P01" } }));
    const res = await GET(new Request("http://localhost/api/email/signatures"));
    expect(res.status).toBe(500);
    expect((await res.json()).ok).toBe(false);
  });
});

describe("PUT /api/email/signatures", () => {
  function upsertClient(error: { code: string } | null = null) {
    const upsert = vi.fn(async () => ({ error }));
    createSupabaseServerClient.mockResolvedValue({ from: vi.fn(() => ({ upsert })) });
    return upsert;
  }

  it("sin Admin devuelve la denegación y no escribe", async () => {
    requireAdmin.mockResolvedValue(
      new Response(JSON.stringify({ ok: false }), { status: 403 }),
    );
    const res = await PUT(putRequest({ mailbox: "hola@galladev.com", signature: "x" }));
    expect(res.status).toBe(403);
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("guarda la firma normalizada del buzón con onConflict", async () => {
    const upsert = upsertClient();
    const res = await PUT(
      putRequest({ mailbox: "Hola@galladev.com", signature: "  Ociel\r\nGallaDev  " }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      mailbox: "hola@galladev.com",
      signature: "Ociel\nGallaDev",
    });
    expect(upsert).toHaveBeenCalledWith(
      {
        mailbox_address: "hola@galladev.com",
        signature: "Ociel\nGallaDev",
        updated_by: "ed07cdd4-c542-4f9a-8b8e-bd73e358c6cd",
      },
      { onConflict: "mailbox_address" },
    );
  });

  it("permite vaciar la firma", async () => {
    const upsert = upsertClient();
    const res = await PUT(putRequest({ mailbox: "ociel@galladev.com", signature: "" }));
    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ signature: "" }),
      expect.anything(),
    );
  });

  it.each([
    ["buzón fuera de la lista", { mailbox: "otro@galladev.com", signature: "x" }],
    ["firma que no es texto", { mailbox: "hola@galladev.com", signature: 5 }],
    ["firma demasiado larga", { mailbox: "hola@galladev.com", signature: "x".repeat(2001) }],
    ["campo extra", { mailbox: "hola@galladev.com", signature: "x", html: "<b>" }],
    ["JSON que no es objeto", ["a"]],
  ])("rechaza %s con 400 sin escribir", async (_name, body) => {
    const upsert = upsertClient();
    const res = await PUT(putRequest(body));
    expect(res.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("JSON inválido es 400 y cuerpo enorme es 413", async () => {
    upsertClient();
    expect((await PUT(putRequest("{no"))).status).toBe(400);
    const huge = await PUT(
      putRequest({ mailbox: "hola@galladev.com", signature: "x".repeat(20_000) }),
    );
    expect(huge.status).toBe(413);
  });

  it("rate limit responde 429", async () => {
    upsertClient();
    consumeRateLimit.mockResolvedValue(true);
    const res = await PUT(putRequest({ mailbox: "hola@galladev.com", signature: "x" }));
    expect(res.status).toBe(429);
  });

  it("error de base de datos responde 500", async () => {
    upsertClient({ code: "42501" });
    const res = await PUT(putRequest({ mailbox: "hola@galladev.com", signature: "x" }));
    expect(res.status).toBe(500);
  });
});
