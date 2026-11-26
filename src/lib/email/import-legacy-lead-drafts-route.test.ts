import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdmin = vi.hoisted(() =>
  vi.fn(async (): Promise<Response | null> => null),
);
const consumeRateLimit = vi.hoisted(() => vi.fn(async () => false));
const createSupabaseAdminClient = vi.hoisted(() => vi.fn(() => ({})));
const importLegacyLeadDrafts = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({ requireAdmin }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient }));
vi.mock("@/lib/email/import-legacy-lead-drafts", () => ({ importLegacyLeadDrafts }));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  consumeRateLimit,
}));

function post(body?: unknown): Request {
  return new Request("http://localhost/api/email/drafts/import-legacy-leads", {
    method: "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function run(request: Request) {
  const { POST } = await import(
    "@/app/api/email/drafts/import-legacy-leads/route"
  );
  return POST(request);
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue(null);
  consumeRateLimit.mockResolvedValue(false);
  importLegacyLeadDrafts.mockResolvedValue({
    dryRun: true,
    scanned: 1,
    created: [],
    skipped: 1,
    nextOffset: null,
  });
});

describe("POST /api/email/drafts/import-legacy-leads", () => {
  it("solo Admin: sin permiso no toca la BD", async () => {
    requireAdmin.mockResolvedValue(new Response(null, { status: 403 }));
    const res = await run(post({ dryRun: true }));
    expect(res.status).toBe(403);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(importLegacyLeadDrafts).not.toHaveBeenCalled();
  });

  it("pasa dryRun, limit y offset a la importación", async () => {
    const res = await run(post({ dryRun: true, limit: 10, offset: 5 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, dryRun: true, skipped: 1 });
    expect(importLegacyLeadDrafts).toHaveBeenCalledWith(expect.anything(), {
      dryRun: true,
      limit: 10,
      offset: 5,
    });
  });

  it("sin body asume dryRun por defecto en el servidor", async () => {
    const res = await run(post());
    expect(res.status).toBe(200);
    expect(importLegacyLeadDrafts).toHaveBeenCalledWith(expect.anything(), {});
  });

  it("429 si el limitador se agota", async () => {
    consumeRateLimit.mockResolvedValue(true);
    const res = await run(post({ dryRun: false }));
    expect(res.status).toBe(429);
    expect(importLegacyLeadDrafts).not.toHaveBeenCalled();
  });
});
