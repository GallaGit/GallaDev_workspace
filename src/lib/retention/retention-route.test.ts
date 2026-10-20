import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RetentionResult } from "@/lib/retention/retention";

/**
 * Contratos de GET /api/cron/retention (cron de Vercel).
 * Sin sesión: solo CRON_SECRET en la cabecera Authorization.
 */

const SECRET = "retention-secret-0123456789";
const CRON_URL = "http://localhost/api/cron/retention";

type RpcResponse = { data: unknown; error: { message: string } | null };

const rpc = vi.hoisted(() =>
  vi.fn<(fn: string, args: Record<string, unknown>) => Promise<RpcResponse>>(
    async () => ({ data: null, error: null }),
  ),
);

const remove = vi.hoisted(() =>
  vi.fn<(paths: string[]) => Promise<{ error: unknown }>>(async () => ({ error: null })),
);

const storageFrom = vi.hoisted(() =>
  vi.fn<(bucket: string) => { remove: typeof remove }>(() => ({ remove })),
);

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ rpc, storage: { from: storageFrom } }),
}));

const DRY_RESULT: RetentionResult = {
  dry_run: true,
  leads: 2,
  clients: 1,
  activities: 5,
  email_threads: 3,
  email_messages: 7,
  email_attachments: 4,
  email_drafts: 1,
  storage_paths: ["mail/2024/a.pdf"],
};

const REAL_RESULT: RetentionResult = {
  ...DRY_RESULT,
  dry_run: false,
  storage_paths: [],
};

function cronRequest(url = CRON_URL, authorization?: string): Request {
  const headers = new Headers();
  if (authorization !== undefined) headers.set("authorization", authorization);
  return new Request(url, { headers });
}

async function getRoute() {
  const { GET } = await import("@/app/api/cron/retention/route");
  return GET;
}

let infoSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

describe("GET /api/cron/retention", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: DRY_RESULT, error: null });
    storageFrom.mockClear();
    remove.mockClear();
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.stubEnv("RETENTION_ENABLED", undefined);
    vi.stubEnv("EMAIL_ATTACHMENTS_BUCKET", undefined);
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("401 sin cabecera Authorization", async () => {
    const GET = await getRoute();
    const res = await GET(cronRequest());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, error: "unauthorized" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("401 con un secreto distinto", async () => {
    const GET = await getRoute();
    const res = await GET(cronRequest(CRON_URL, `Bearer ${"otro-secreto-seguro-123"}`));

    expect(res.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("dry-run por defecto cuando RETENTION_ENABLED no está definido", async () => {
    const GET = await getRoute();
    const res = await GET(cronRequest(CRON_URL, `Bearer ${SECRET}`));

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("purge_expired_personal_data", { dry_run: true });
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      dry_run: true,
      leads: 2,
      clients: 1,
      activities: 5,
      email_threads: 3,
      email_messages: 7,
      email_attachments: 4,
      email_drafts: 1,
      storage_files: 1,
      storage_removed: 0,
    });
    expect(body).not.toHaveProperty("storage_paths");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining("[retention] dry_run=true"));
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it("ejecución real con RETENTION_ENABLED=true", async () => {
    vi.stubEnv("RETENTION_ENABLED", "true");
    rpc.mockResolvedValue({ data: REAL_RESULT, error: null });

    const GET = await getRoute();
    const res = await GET(cronRequest(CRON_URL, `Bearer ${SECRET}`));

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("purge_expired_personal_data", { dry_run: false });
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.dry_run).toBe(false);
    expect(body.storage_files).toBe(0);
    expect(body.storage_removed).toBe(0);
    expect(body).not.toHaveProperty("storage_paths");
  });

  it("dry_run=1 fuerza dry-run aunque RETENTION_ENABLED=true", async () => {
    vi.stubEnv("RETENTION_ENABLED", "true");

    const GET = await getRoute();
    const res = await GET(
      cronRequest(`${CRON_URL}?dry_run=1`, `Bearer ${SECRET}`),
    );

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("purge_expired_personal_data", { dry_run: true });
    expect((await res.json()).dry_run).toBe(true);
  });

  it("500 sin filtrar el mensaje del error del RPC", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "permission denied for function purge_expired_personal_data" },
    });

    const GET = await getRoute();
    const res = await GET(cronRequest(CRON_URL, `Bearer ${SECRET}`));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "retention_failed" });
    expect(JSON.stringify(body)).not.toContain("permission denied");
    expect(errorSpy).toHaveBeenCalledWith("[retention] failed");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
