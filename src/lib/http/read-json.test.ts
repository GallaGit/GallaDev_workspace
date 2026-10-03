import { describe, expect, it } from "vitest";
import { readJsonResponse } from "./read-json";

const EMPTY_500 =
  "El servidor respondió sin datos (HTTP 500). Inténtalo de nuevo o revisa los registros.";

describe("readJsonResponse", () => {
  it("un 500 con cuerpo vacío no lanza Unexpected end of JSON input", async () => {
    const res = new Response(null, { status: 500 });
    await expect(readJsonResponse(res, "Error al cargar hilo")).rejects.toThrow(
      EMPTY_500,
    );
  });

  it("un cuerpo HTML se trata como sesión o respuesta inesperada", async () => {
    const res = new Response("<html><body>login</body></html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
    await expect(readJsonResponse(res, "Error")).rejects.toThrow(
      "Sesión caducada o respuesta inesperada (HTTP 200). Recarga la página.",
    );
  });

  it("un 403 JSON usa data.error", async () => {
    const res = new Response(
      JSON.stringify({ ok: false, error: "No tienes permiso" }),
      {
        status: 403,
        headers: { "content-type": "application/json" },
      },
    );
    await expect(readJsonResponse(res, "Error al cargar")).rejects.toThrow(
      "No tienes permiso",
    );
  });

  it("un 200 JSON válido se devuelve", async () => {
    const res = new Response(JSON.stringify({ ok: true, threads: [] }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
    await expect(
      readJsonResponse<{ ok: boolean; threads: unknown[] }>(res, "Error"),
    ).resolves.toEqual({ ok: true, threads: [] });
  });
});
