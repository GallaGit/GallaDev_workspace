import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdmin = vi.hoisted(() =>
  vi.fn(async (): Promise<Response | null> => null),
);

vi.mock("@/lib/api-auth", () => ({
  requireAdmin,
}));

vi.mock("@/lib/email/sanitize-email-html", () => {
  throw new Error("ERR_REQUIRE_ESM");
});

const THREAD_ID = "ed07cdd4-c542-4f9a-8b8e-bd73e358c6cd";

function threadRequest(): Request {
  return new Request(`http://localhost/api/email/threads/${THREAD_ID}`, {
    headers: { "x-request-id": "req-correo" },
  });
}

describe("GET /api/email/threads/[id] si el sanitizer no carga", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockResolvedValue(null);
  });

  it("el módulo carga y responde JSON 500, no un cuerpo vacío", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { GET } = await import("@/app/api/email/threads/[id]/route");
    const res = await GET(threadRequest(), {
      params: Promise.resolve({ id: THREAD_ID }),
    });

    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text.length).toBeGreaterThan(0);
    expect(JSON.parse(text)).toEqual({ ok: false, error: "Error interno" });
    expect(text).not.toContain("ERR_REQUIRE_ESM");

    const logged = spy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).toContain("GET /api/email/threads/");
    expect(logged).not.toContain("ERR_REQUIRE_ESM");
    spy.mockRestore();
  });

  it("un throw antes del try también responde JSON", async () => {
    requireAdmin.mockRejectedValue(new Error("auth down"));
    const { GET } = await import("@/app/api/email/threads/[id]/route");
    const res = await GET(threadRequest(), {
      params: Promise.resolve({ id: THREAD_ID }),
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "Error interno" });
  });
});
