import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clientIp,
  consumeRateLimit,
  isRateLimited,
  readCappedJson,
  resetRateLimits,
} from "./rate-limit";

function requestWith(
  headers: Record<string, string> = {},
  body?: string,
): Request {
  return new Request("http://localhost/api/x", {
    method: "POST",
    headers,
    body,
  });
}

afterEach(() => {
  resetRateLimits();
});

describe("clientIp", () => {
  it("prefiere x-vercel-forwarded-for al primer tramo reenviado", () => {
    expect(
      clientIp(
        requestWith({
          "x-forwarded-for": "1.2.3.4, 5.6.7.8",
          "x-vercel-forwarded-for": "203.0.113.8",
        }),
      ),
    ).toBe("203.0.113.8");
  });

  it("sin cabecera de Vercel usa el último salto de x-forwarded-for", () => {
    expect(
      clientIp(requestWith({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })),
    ).toBe("5.6.7.8");
  });

  it("usa request.ip si no hay cabeceras", () => {
    const request = requestWith();
    Object.defineProperty(request, "ip", { value: "203.0.113.50" });
    expect(clientIp(request)).toBe("203.0.113.50");
  });

  it("unknown sin cabecera o vacía", () => {
    expect(clientIp(requestWith())).toBe("unknown");
    expect(clientIp(requestWith({ "x-forwarded-for": "  " }))).toBe(
      "unknown",
    );
  });
});

describe("isRateLimited", () => {
  it("permite hasta max y bloquea el siguiente", () => {
    const now = 1_000_000;
    expect(isRateLimited("ns", "1.1.1.1", { max: 2 }, now)).toBe(false);
    expect(isRateLimited("ns", "1.1.1.1", { max: 2 }, now + 1)).toBe(false);
    expect(isRateLimited("ns", "1.1.1.1", { max: 2 }, now + 2)).toBe(true);
  });

  it("la ventana deslizante libera tras windowMs", () => {
    expect(
      isRateLimited("ns", "2.2.2.2", { max: 1, windowMs: 1000 }, 0),
    ).toBe(false);
    expect(
      isRateLimited("ns", "2.2.2.2", { max: 1, windowMs: 1000 }, 500),
    ).toBe(true);
    expect(
      isRateLimited("ns", "2.2.2.2", { max: 1, windowMs: 1000 }, 1001),
    ).toBe(false);
  });

  it("namespaces e IPs son independientes", () => {
    expect(isRateLimited("a", "ip", { max: 1 }, 0)).toBe(false);
    expect(isRateLimited("b", "ip", { max: 1 }, 0)).toBe(false);
    expect(isRateLimited("a", "otra-ip", { max: 1 }, 0)).toBe(false);
  });
});

describe("consumeRateLimit", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sin Upstash usa el contador de esta instancia", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await consumeRateLimit("ns", "1.1.1.1", { max: 1 }, 0)).toBe(false);
    expect(await consumeRateLimit("ns", "1.1.1.1", { max: 1 }, 1)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("con Upstash cuenta en Redis y no abre otro cupo por cabecera", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token-test");
    const fetchMock = vi.fn(async () =>
      Response.json([{ result: 2 }, { result: 1 }]),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(
      await consumeRateLimit("ingest:n8n", "203.0.113.8", { max: 1 }, 5_000),
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const init = (fetchMock.mock.calls as unknown as [string, { body?: string }][])[0]?.[1];
    const body = JSON.parse(String(init?.body));
    expect(body[0][0]).toBe("INCR");
    expect(String(body[0][1])).toContain("ingest:n8n");
  });
});

describe("readCappedJson", () => {
  it("parsea JSON dentro del tope", async () => {
    const res = await readCappedJson(
      requestWith({}, JSON.stringify({ a: 1 })),
      1024,
    );
    expect(res).toEqual({ ok: true, value: { a: 1 } });
  });

  it("413 si supera maxBytes", async () => {
    const res = await readCappedJson(requestWith({}, '{"a":"x"}'), 4);
    expect(res).toEqual({ ok: false, status: 413 });
  });

  it("400 con JSON inválido", async () => {
    const res = await readCappedJson(requestWith({}, "{no-json"), 1024);
    expect(res).toEqual({ ok: false, status: 400 });
  });
});
