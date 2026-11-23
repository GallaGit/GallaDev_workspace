import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdmin = vi.hoisted(() =>
  vi.fn(async (): Promise<Response | null> => null),
);
const consumeRateLimit = vi.hoisted(() => vi.fn(async () => false));
const createSupabaseAdminClient = vi.hoisted(() => vi.fn(() => ({})));
const backfillLeadLinks = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({ requireAdmin }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient }));
vi.mock("@/lib/email/lead-link-backfill", () => ({ backfillLeadLinks }));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  consumeRateLimit,
}));

function post(body?: unknown): Request {
  return new Request("http://localhost/api/email/backfill-lead-links", {
    method: "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function run(request: Request) {
  const { POST } = await import("@/app/api/email/backfill-lead-links/route");
  return POST(request);
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue(null);
  consumeRateLimit.mockResolvedValue(false);
  backfillLeadLinks.mockResolvedValue({
    dryRun: true,
    threadsScanned: 1,
    linked: [],
    ambiguous: 0,
    noMatch: 1,
    skipped: 0,
    nextOffset: null,
  });
});

describe("POST /api/email/backfill-lead-links", () => {
  it("solo Admin: sin permiso no toca la BD", async () => {
    requireAdmin.mockResolvedValue(new Response(null, { status: 403 }));
    const res = await run(post({ dryRun: true }));
    expect(res.status).toBe(403);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(backfillLeadLinks).not.toHaveBeenCalled();
  });

  it("pasa dryRun, limit y offset al backfill", async () => {
    const res = await run(post({ dryRun: true, limit: 10, offset: 5 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, dryRun: true, noMatch: 1 });
    expect(backfillLeadLinks).toHaveBeenCalledWith(expect.anything(), {
      dryRun: true,
      limit: 10,
      offset: 5,
    });
  });

  it("sin cuerpo usa los valores por defecto", async () => {
    const res = await run(post());
    expect(res.status).toBe(200);
    expect(backfillLeadLinks).toHaveBeenCalledWith(expect.anything(), {});
  });

  it("cuerpo no válido → 400", async () => {
    const res = await run(post({ dryRun: "sí" }));
    expect(res.status).toBe(400);
    expect(backfillLeadLinks).not.toHaveBeenCalled();
  });

  it("rate limit → 429", async () => {
    consumeRateLimit.mockResolvedValue(true);
    const res = await run(post({}));
    expect(res.status).toBe(429);
    expect(backfillLeadLinks).not.toHaveBeenCalled();
  });

  it("error interno → 500 genérico", async () => {
    backfillLeadLinks.mockRejectedValue(new Error("secreto interno"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await run(post({}));
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("secreto");
    spy.mockRestore();
  });
});
