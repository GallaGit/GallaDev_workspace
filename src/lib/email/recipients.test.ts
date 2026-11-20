import { describe, expect, it } from "vitest";
import {
  dedupeRecipients,
  exceedsRecipientTotal,
  MAX_RECIPIENTS_PER_FIELD,
  MAX_RECIPIENTS_TOTAL,
  parseAddressList,
  parseRecipientList,
  splitAddressInput,
} from "./recipients";

describe("splitAddressInput", () => {
  it("separa por comas, punto y coma y saltos de línea", () => {
    expect(splitAddressInput("a@x.com, b@x.com;c@x.com\nd@x.com\r\n e@x.com ,,")).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
      "d@x.com",
      "e@x.com",
    ]);
  });

  it("devuelve lista vacía para texto en blanco", () => {
    expect(splitAddressInput("  , ; ")).toEqual([]);
  });
});

describe("parseAddressList", () => {
  it("normaliza, extrae «Nombre <a@b>» y quita duplicados", () => {
    expect(
      parseAddressList("Ana <Ana@Example.com>, ana@example.com, bob@example.com"),
    ).toEqual({ valid: ["ana@example.com", "bob@example.com"], invalid: [] });
  });

  it("separa las direcciones no válidas", () => {
    expect(parseAddressList("ok@example.com, basura, a@b")).toEqual({
      valid: ["ok@example.com"],
      invalid: ["basura", "a@b"],
    });
  });

  it("acepta un array de strings", () => {
    expect(parseAddressList(["a@x.com", " b@x.com ", ""])).toEqual({
      valid: ["a@x.com", "b@x.com"],
      invalid: [],
    });
  });

  it("rechaza saltos de línea dentro de una dirección (inyección de cabeceras)", () => {
    expect(parseAddressList(["a@x.com\r\nBcc: evil@x.com"]).invalid).toHaveLength(1);
  });
});

describe("dedupeRecipients", () => {
  it("quita de Cc lo que está en Para y de Cco lo que está en Para o Cc", () => {
    expect(
      dedupeRecipients({
        to: ["a@x.com"],
        cc: ["a@x.com", "b@x.com", "b@x.com"],
        bcc: ["a@x.com", "b@x.com", "c@x.com"],
      }),
    ).toEqual({ to: ["a@x.com"], cc: ["b@x.com"], bcc: ["c@x.com"] });
  });
});

describe("parseRecipientList", () => {
  it("ausente o vacío es lista vacía", () => {
    expect(parseRecipientList(undefined, "Cc")).toEqual({ ok: true, value: [] });
    expect(parseRecipientList(null, "Cc")).toEqual({ ok: true, value: [] });
    expect(parseRecipientList("", "Cc")).toEqual({ ok: true, value: [] });
  });

  it("acepta string con varias direcciones o array", () => {
    expect(parseRecipientList("a@x.com, B@x.com", "Cc")).toEqual({
      ok: true,
      value: ["a@x.com", "b@x.com"],
    });
    expect(parseRecipientList(["a@x.com"], "Cco")).toEqual({
      ok: true,
      value: ["a@x.com"],
    });
  });

  it("rechaza tipos incorrectos y direcciones no válidas con el nombre del campo", () => {
    expect(parseRecipientList(5, "Cc")).toEqual({ ok: false, error: "Cc no válido" });
    expect(parseRecipientList([1], "Cco")).toEqual({ ok: false, error: "Cco no válido" });
    expect(parseRecipientList("a@x.com, nope", "Cco")).toEqual({
      ok: false,
      error: "Cco no válido",
    });
  });

  it("limita el número de direcciones por campo", () => {
    const many = Array.from(
      { length: MAX_RECIPIENTS_PER_FIELD + 1 },
      (_, i) => `u${i}@x.com`,
    );
    const result = parseRecipientList(many, "Cc");
    expect(result.ok).toBe(false);
  });
});

describe("exceedsRecipientTotal", () => {
  it("compara la suma con el tope por correo", () => {
    const some = (n: number) => Array.from({ length: n }, (_, i) => `u${i}@x.com`);
    expect(exceedsRecipientTotal({ to: ["a@x.com"], cc: some(20), bcc: some(20) })).toBe(false);
    expect(
      exceedsRecipientTotal({
        to: some(10),
        cc: some(20),
        bcc: some(MAX_RECIPIENTS_TOTAL - 30 + 1),
      }),
    ).toBe(true);
  });
});
