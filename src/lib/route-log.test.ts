import { afterEach, describe, expect, it, vi } from "vitest";
import { errorClassOf, logRouteError, requestIdFrom } from "./route-log";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("errorClassOf", () => {
  it("usa el nombre y un código corto si existen", () => {
    const error = new Error("fallo con user@example.com y bearer secreto");
    error.name = "PainAnalysisError";
    (error as { code?: string }).code = "provider";
    expect(errorClassOf(error)).toBe("PainAnalysisError:provider");
  });

  it("ignora códigos que no son una clase (emails, frases)", () => {
    const error = new Error("db");
    (error as { code?: string }).code = "user@example.com";
    expect(errorClassOf(error)).toBe("Error");
    expect(errorClassOf("boom")).toBe("NonError");
  });
});

describe("requestIdFrom", () => {
  it("lee x-request-id o x-vercel-id si el valor es un id", () => {
    const request = new Request("http://localhost/api/x", {
      headers: { "x-request-id": "req_123" },
    });
    expect(requestIdFrom(request)).toBe("req_123");
  });

  it("descarta ids que parecen secretos o contacto", () => {
    const request = new Request("http://localhost/api/x", {
      headers: { "x-request-id": "Bearer super-secret user@example.com" },
    });
    expect(requestIdFrom(request)).toBeUndefined();
  });
});

describe("logRouteError", () => {
  it("escribe una línea JSON sin el mensaje de la excepción", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const leaked = "token-secreto user@example.com";
    logRouteError({
      route: "POST /api/ingest/lead",
      status: 500,
      errorClass: errorClassOf(new Error(leaked)),
      requestId: "req-1",
      leadId: "lead-1",
    });
    expect(spy).toHaveBeenCalledOnce();
    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).not.toContain(leaked);
    expect(JSON.parse(line)).toEqual({
      level: "error",
      route: "POST /api/ingest/lead",
      status: 500,
      errorClass: "Error",
      requestId: "req-1",
      leadId: "lead-1",
    });
  });
});
