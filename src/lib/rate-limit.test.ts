import { afterEach, describe, expect, it } from "vitest";
import {
  clientIp,
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
  it("usa el primer valor de x-forwarded-for", () => {
    expect(
      clientIp(requestWith({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })),
    ).toBe("1.2.3.4");
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
