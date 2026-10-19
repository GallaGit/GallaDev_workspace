import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clientIp,
  consumeRateLimit,
  isRateLimited,
  readCappedJson,
  resetRateLimits,
} from "./rate-limit";

const limitMock = vi.hoisted(() => vi.fn());
const ratelimitOptions = vi.hoisted<unknown[]>(() => []);
const redisOptions = vi.hoisted<unknown[]>(() => []);
const slidingWindowMock = vi.hoisted(() =>
  vi.fn((tokens: number, window: string) => ({
    kind: "slidingWindow",
    tokens,
    window,
  })),
);

vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    static slidingWindow = slidingWindowMock;
    limit = limitMock;
    constructor(options: unknown) {
      ratelimitOptions.push(options);
    }
  }
  return { Ratelimit };
});

vi.mock("@upstash/redis", () => {
  class Redis {
    constructor(options: unknown) {
      redisOptions.push(options);
    }
  }
  return { Redis };
});

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
  beforeEach(() => {
    for (const name of [
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "KV_REST_API_URL",
      "KV_REST_API_TOKEN",
    ]) {
      vi.stubEnv(name, "");
    }
    limitMock.mockReset();
    ratelimitOptions.length = 0;
    redisOptions.length = 0;
    slidingWindowMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("sin Upstash usa el contador de esta instancia", async () => {
    expect(await consumeRateLimit("ns", "1.1.1.1", { max: 1 }, 0)).toBe(false);
    expect(await consumeRateLimit("ns", "1.1.1.1", { max: 1 }, 1)).toBe(true);
    expect(redisOptions).toHaveLength(0);
    expect(ratelimitOptions).toHaveLength(0);
    expect(limitMock).not.toHaveBeenCalled();
  });

  it("con Upstash cuenta en Redis con ventana deslizante y namespace", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token-test");
    limitMock.mockResolvedValue({ success: false });
    expect(
      await consumeRateLimit("ingest:n8n", "203.0.113.8", { max: 1 }, 5_000),
    ).toBe(true);
    expect(limitMock).toHaveBeenCalledWith("203.0.113.8");
    expect(ratelimitOptions).toHaveLength(1);
    const options = ratelimitOptions[0] as {
      prefix: string;
      limiter: { kind: string; tokens: number; window: string };
    };
    expect(options.prefix).toContain("ingest:n8n");
    expect(options.limiter).toEqual({
      kind: "slidingWindow",
      tokens: 1,
      window: "60000 ms",
    });
  });

  it("devuelve false cuando Upstash deja pasar la petición", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token-test");
    limitMock.mockResolvedValue({ success: true });
    expect(await consumeRateLimit("ns", "9.9.9.9", { max: 1 }, 0)).toBe(false);
  });

  it("el cupo de Upstash manda aunque la memoria diga lo contrario", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token-test");
    limitMock.mockResolvedValue({ success: true });
    expect(await consumeRateLimit("ns", "2.2.2.2", { max: 1 }, 0)).toBe(false);
    expect(await consumeRateLimit("ns", "2.2.2.2", { max: 1 }, 1)).toBe(false);
    expect(limitMock).toHaveBeenCalledTimes(2);
  });

  it("con KV_REST_API_* de Vercel KV también usa Redis", async () => {
    vi.stubEnv("KV_REST_API_URL", "https://kv.example.upstash.io/");
    vi.stubEnv("KV_REST_API_TOKEN", "kv-token");
    limitMock.mockResolvedValue({ success: true });
    expect(await consumeRateLimit("ns", "3.3.3.3", { max: 5 }, 0)).toBe(false);
    expect(limitMock).toHaveBeenCalledWith("3.3.3.3");
    expect(redisOptions[0]).toMatchObject({
      url: "https://kv.example.upstash.io",
      token: "kv-token",
    });
  });

  it("rehace el limitador si cambian las credenciales de Upstash", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token-a");
    limitMock.mockResolvedValue({ success: true });
    expect(await consumeRateLimit("ns", "7.7.7.7", { max: 1 }, 0)).toBe(false);
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token-b");
    expect(await consumeRateLimit("ns", "7.7.7.7", { max: 1 }, 1)).toBe(false);
    expect(redisOptions).toHaveLength(2);
    expect(redisOptions[1]).toMatchObject({ token: "token-b" });
    expect(ratelimitOptions).toHaveLength(2);
  });

  it("si Upstash lanza vuelve a memoria y avisa sin romperse", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token-test");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    limitMock.mockRejectedValue(new Error("boom upstash"));
    expect(await consumeRateLimit("ns", "4.4.4.4", { max: 1 }, 0)).toBe(false);
    expect(await consumeRateLimit("ns", "4.4.4.4", { max: 1 }, 1)).toBe(true);
    expect(warn).toHaveBeenCalledWith(
      "[rate-limit] Upstash no disponible, uso memoria:",
      "boom upstash",
    );
    expect(warn.mock.calls.flat().join(" ")).not.toContain("token-test");
  });

  it("un timeout de Upstash se trata como fallo y cae a memoria", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token-test");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    limitMock.mockResolvedValue({ success: true, reason: "timeout" });
    expect(await consumeRateLimit("ns", "5.5.5.5", { max: 1 }, 0)).toBe(false);
    expect(await consumeRateLimit("ns", "5.5.5.5", { max: 1 }, 1)).toBe(true);
    expect(warn).toHaveBeenCalled();
  });

  it("una URL que no es https se trata como no configurada", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "http://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token-test");
    expect(await consumeRateLimit("ns", "6.6.6.6", { max: 1 }, 0)).toBe(false);
    expect(await consumeRateLimit("ns", "6.6.6.6", { max: 1 }, 1)).toBe(true);
    expect(redisOptions).toHaveLength(0);
    expect(ratelimitOptions).toHaveLength(0);
    expect(limitMock).not.toHaveBeenCalled();
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
