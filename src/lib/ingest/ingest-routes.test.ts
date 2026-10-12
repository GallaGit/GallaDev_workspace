import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INGEST_RECEIPT_KEY,
  INGEST_RECEIPT_MAX,
  INGEST_RECEIPT_NAMESPACE,
  INGEST_RECEIPT_WINDOW_MS,
  isRateLimited,
  resetRateLimits,
} from "@/lib/rate-limit";

/**
 * Contratos de la ingesta pública (bearer), no de la sesión Supabase.
 * Los topes viven en la ruta: lead 32 KiB / 30 por minuto. n8n responde 410.
 */
const SECRET = "test-ingest-secret";
const LEAD_MAX_BYTES = 32 * 1024;
const LEAD_RATE_MAX = 30;

const repo = vi.hoisted(() => ({
  list: vi.fn(async (): Promise<unknown[]> => []),
  create: vi.fn(async (): Promise<{ id: string }> => {
    throw new Error("repository should not be called");
  }),
  update: vi.fn(),
}));

const sendIngestEmails = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/lib/repository/get-repository", () => ({
  getPrivilegedLeadRepository: () => repo,
  getLeadRepository: () => {
    throw new Error("session repository");
  },
}));

vi.mock("@/lib/email/send-ingest-emails", () => ({
  sendIngestEmails,
}));

vi.mock("@/lib/automations/dispatch", () => ({
  dispatchLeadCreated: vi.fn(() => ({ status: "skipped", reason: "inactive" })),
}));

const LEAD_URL = "http://localhost/api/ingest/lead";

function ingestRequest(
  url: string,
  options: {
    bearer?: string | null;
    body?: string;
    ip?: string;
    requestId?: string;
  } = {},
): Request {
  const headers = new Headers();
  if (options.bearer !== null) {
    headers.set("Authorization", `Bearer ${options.bearer ?? SECRET}`);
  }
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (options.ip) headers.set("x-forwarded-for", options.ip);
  if (options.requestId) headers.set("x-request-id", options.requestId);
  return new Request(url, {
    method: "POST",
    headers,
    body: options.body,
  });
}

const landingBody = JSON.stringify({
  name: "Ana Lopez",
  email: "ana@example.com",
  company: "Acme",
  message: "Necesitamos automatizar la facturacion del despacho.",
});

async function expectError(res: Response, status: number, error: string) {
  expect(res.status).toBe(status);
  expect(await res.json()).toEqual({ ok: false, error });
}

function loggedText(spy: { mock: { calls: unknown[][] } }): string {
  return spy.mock.calls
    .flat()
    .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
    .join("\n");
}

function loggedLine(
  spy: { mock: { calls: unknown[][] } },
  includes: string,
): string {
  const line = spy.mock.calls
    .map((call) => call[0])
    .find(
      (part): part is string =>
        typeof part === "string" && part.includes(includes),
    );
  return String(line);
}

let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  vi.stubEnv("INGEST_SECRET", SECRET);
  repo.list.mockResolvedValue([]);
  repo.create.mockImplementation(async () => {
    throw new Error("repository should not be called");
  });
  sendIngestEmails.mockResolvedValue(undefined);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/ingest/lead", () => {
  it("401 si falta el bearer o no coincide", async () => {
    const { POST } = await import("@/app/api/ingest/lead/route");
    const missing = await POST(ingestRequest(LEAD_URL, { bearer: null, body: "{}" }));
    await expectError(missing, 401, "No autorizado");

    const wrong = await POST(
      ingestRequest(LEAD_URL, { bearer: "test-ingest-secreX", body: "{}" }),
    );
    await expectError(wrong, 401, "No autorizado");
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("429 al superar el límite en memoria por IP", async () => {
    const { POST } = await import("@/app/api/ingest/lead/route");
    const ip = "198.51.100.10";
    for (let i = 0; i < LEAD_RATE_MAX; i++) {
      const allowed = await POST(
        ingestRequest(LEAD_URL, { body: "{}", ip }),
      );
      expect(allowed.status).not.toBe(429);
    }
    const blocked = await POST(ingestRequest(LEAD_URL, { body: "{}", ip }));
    await expectError(
      blocked,
      429,
      "Demasiadas solicitudes. Inténtalo más tarde.",
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("413 si el cuerpo supera el tope", async () => {
    const { POST } = await import("@/app/api/ingest/lead/route");
    const res = await POST(
      ingestRequest(LEAD_URL, {
        body: "x".repeat(LEAD_MAX_BYTES + 1),
        ip: "198.51.100.11",
      }),
    );
    await expectError(res, 413, "Payload demasiado grande");
    expect(repo.create).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("el catch de guardado registra la ruta sin secreto ni cuerpo", async () => {
    const leaked = `${SECRET} leak@example.com`;
    repo.create.mockRejectedValueOnce(new Error(`db down ${leaked}`));
    const { POST } = await import("@/app/api/ingest/lead/route");
    const res = await POST(
      ingestRequest(LEAD_URL, {
        body: landingBody,
        ip: "198.51.100.12",
        requestId: "req-lead-500",
      }),
    );
    await expectError(res, 500, "No se pudo guardar el lead");
    const dumped = `${loggedText(errorSpy)}\n${loggedText(warnSpy)}`;
    expect(dumped).not.toContain(SECRET);
    expect(dumped).not.toContain("leak@example.com");
    expect(dumped).not.toContain("ana@example.com");
    expect(dumped).not.toContain("Necesitamos automatizar");
    expect(JSON.parse(loggedLine(errorSpy, "/api/ingest/lead"))).toEqual({
      level: "error",
      route: "POST /api/ingest/lead",
      status: 500,
      errorClass: "Error",
      requestId: "req-lead-500",
    });
  });

  it("el fallo de email es fail-open y no vuelca el destinatario", async () => {
    repo.create.mockResolvedValueOnce({ id: "lead-1" });
    sendIngestEmails.mockRejectedValueOnce(
      new Error(`resend ${SECRET} visitor@example.com`),
    );
    const { POST } = await import("@/app/api/ingest/lead/route");
    const res = await POST(
      ingestRequest(LEAD_URL, {
        body: landingBody,
        ip: "198.51.100.13",
        requestId: "req-lead-mail",
      }),
    );
    expect(res.status).toBe(201);
    const dumped = `${loggedText(errorSpy)}\n${loggedText(warnSpy)}`;
    expect(dumped).not.toContain(SECRET);
    expect(dumped).not.toContain("visitor@example.com");
    expect(dumped).not.toContain("ana@example.com");
    expect(JSON.parse(loggedLine(warnSpy, "/api/ingest/lead"))).toEqual({
      level: "warn",
      route: "POST /api/ingest/lead",
      errorClass: "Error",
      requestId: "req-lead-mail",
    });
  });

  it("guarda el lead y no manda el acuse al pasar el cupo diario", async () => {
    for (let i = 0; i < INGEST_RECEIPT_MAX; i += 1) {
      isRateLimited(INGEST_RECEIPT_NAMESPACE, INGEST_RECEIPT_KEY, {
        windowMs: INGEST_RECEIPT_WINDOW_MS,
        max: INGEST_RECEIPT_MAX,
      });
    }
    repo.create.mockResolvedValueOnce({ id: "lead-capped" });
    const { POST } = await import("@/app/api/ingest/lead/route");
    const res = await POST(
      ingestRequest(LEAD_URL, {
        body: landingBody,
        ip: "198.51.100.40",
      }),
    );
    expect(res.status).toBe(201);
    expect(sendIngestEmails).not.toHaveBeenCalled();
  });
});

describe("POST /api/ingest/n8n (retirada)", () => {
  it("410 sin autenticar ni tocar el repositorio", async () => {
    const { POST } = await import("@/app/api/ingest/n8n/route");
    const res = await POST();
    await expectError(res, 410, "La ingesta desde n8n está desactivada");
    expect(repo.create).not.toHaveBeenCalled();
  });
});
