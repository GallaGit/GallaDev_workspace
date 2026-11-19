import { describe, expect, it } from "vitest";
import {
  FILES_FIELD,
  OUTBOUND_MULTIPART_MAX_BYTES,
  PAYLOAD_FIELD,
  readOutboundRequest,
} from "./outbound-request";
import {
  MAX_OUTBOUND_ATTACHMENT_BYTES,
  MAX_OUTBOUND_ATTACHMENTS,
} from "./outbound-attachments";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/email/compose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

type Part = { name: string; value: string | Uint8Array; filename?: string; type?: string };

/** Multipart escrito a mano: no depende de FormData/File del entorno de test. */
function multipartRequest(parts: Part[]): Request {
  const boundary = "----gdw-test-boundary";
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for (const part of parts) {
    const disposition =
      `Content-Disposition: form-data; name="${part.name}"` +
      (part.filename !== undefined ? `; filename="${part.filename}"` : "");
    const head = `--${boundary}\r\n${disposition}\r\n${
      part.type ? `Content-Type: ${part.type}\r\n` : ""
    }\r\n`;
    chunks.push(enc.encode(head));
    chunks.push(typeof part.value === "string" ? enc.encode(part.value) : part.value);
    chunks.push(enc.encode("\r\n"));
  }
  chunks.push(enc.encode(`--${boundary}--\r\n`));
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const body = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    body.set(c, offset);
    offset += c.byteLength;
  }
  return new Request("http://localhost/api/email/compose", {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  });
}

function filePart(name: string, content: string | Uint8Array, type = "application/octet-stream"): Part {
  return { name: FILES_FIELD, value: content, filename: name, type };
}

function payloadPart(payload: unknown): Part {
  return { name: PAYLOAD_FIELD, value: typeof payload === "string" ? payload : JSON.stringify(payload) };
}

describe("readOutboundRequest", () => {
  it("JSON sin adjuntos pasa tal cual", async () => {
    const result = await readOutboundRequest(jsonRequest({ a: 1 }), "largo");
    expect(result).toEqual({ ok: true, json: { a: 1 }, attachments: [] });
  });

  it("JSON mal formado es 400", async () => {
    const request = new Request("http://localhost/x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{no",
    });
    expect(await readOutboundRequest(request, "largo")).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("multipart: devuelve el payload y los adjuntos con nombre y tipo saneados", async () => {
    const result = await readOutboundRequest(
      multipartRequest([
        payloadPart({ to: "a@x.com" }),
        filePart("../informe.PDF", "hola mundo", "application/pdf"),
      ]),
      "largo",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.json).toEqual({ to: "a@x.com" });
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]).toMatchObject({
      filename: "informe.PDF",
      contentType: "application/pdf",
    });
    expect(result.attachments[0].content.toString()).toBe("hola mundo");
  });

  it("multipart sin payload o con payload no JSON es 400", async () => {
    expect(await readOutboundRequest(multipartRequest([]), "largo")).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(
      await readOutboundRequest(multipartRequest([payloadPart("{no")]), "largo"),
    ).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("rechaza un fichero demasiado grande con 413", async () => {
    const big = new Uint8Array(MAX_OUTBOUND_ATTACHMENT_BYTES + 1).fill(1);
    expect(
      await readOutboundRequest(
        multipartRequest([payloadPart({}), filePart("grande.bin", big)]),
        "largo",
      ),
    ).toMatchObject({
      ok: false,
      status: 413,
    });
  });

  it("rechaza ficheros ejecutables con 400", async () => {
    expect(
      await readOutboundRequest(
        multipartRequest([payloadPart({}), filePart("virus.exe", "x")]),
        "largo",
      ),
    ).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("rechaza demasiados ficheros", async () => {
    const files = Array.from({ length: MAX_OUTBOUND_ATTACHMENTS + 1 }, (_, i) =>
      filePart(`f${i}.txt`, "x"),
    );
    expect(
      await readOutboundRequest(multipartRequest([payloadPart({}), ...files]), "largo"),
    ).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("corta con 413 un cuerpo que supera el tope total (sin fiarse de Content-Length)", async () => {
    const request = new Request("http://localhost/x", {
      method: "POST",
      headers: { "Content-Type": "multipart/form-data; boundary=zzz" },
      body: new Uint8Array(OUTBOUND_MULTIPART_MAX_BYTES + 1),
    });
    expect(request.headers.get("content-length")).toBeNull();
    expect(await readOutboundRequest(request, "largo")).toMatchObject({
      ok: false,
      status: 413,
    });
  });
});
