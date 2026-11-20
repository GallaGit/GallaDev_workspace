import { describe, expect, it } from "vitest";
import {
  hasContentBeyondSignature,
  initialBodyWithSignature,
  MAX_SIGNATURE_CHARS,
  normalizeSignature,
  parseSignatureText,
  signatureBlock,
  stripTrailingSignature,
  swapSignature,
} from "./signature";

describe("signatureBlock / initialBodyWithSignature", () => {
  it("añade espacio para escribir y el separador «-- »", () => {
    expect(signatureBlock("Ociel\nGallaDev")).toBe("\n\n-- \nOciel\nGallaDev");
    expect(initialBodyWithSignature("Ociel")).toBe("\n\n-- \nOciel");
  });

  it("sin firma no añade nada", () => {
    expect(signatureBlock("")).toBe("");
    expect(signatureBlock("   \n ")).toBe("");
    expect(initialBodyWithSignature("")).toBe("");
  });
});

describe("normalizeSignature", () => {
  it("normaliza saltos de línea, recorta y limita la longitud", () => {
    expect(normalizeSignature("  a\r\nb \r\n")).toBe("a\nb");
    expect(normalizeSignature("x".repeat(MAX_SIGNATURE_CHARS + 50))).toHaveLength(
      MAX_SIGNATURE_CHARS,
    );
  });
});

describe("stripTrailingSignature / hasContentBeyondSignature", () => {
  const sig = "Ociel";

  it("solo la firma no cuenta como contenido", () => {
    expect(hasContentBeyondSignature(initialBodyWithSignature(sig), sig)).toBe(false);
    expect(hasContentBeyondSignature("", sig)).toBe(false);
    expect(hasContentBeyondSignature("  \n", "")).toBe(false);
  });

  it("texto antes de la firma sí cuenta", () => {
    const body = `Hola\n\n-- \n${sig}`;
    expect(hasContentBeyondSignature(body, sig)).toBe(true);
    expect(stripTrailingSignature(body, sig)).toBe("Hola");
  });

  it("si la firma fue editada, todo el cuerpo cuenta", () => {
    const body = "\n\n-- \nOciel Galla";
    expect(stripTrailingSignature(body, sig)).toBe(body);
    expect(hasContentBeyondSignature(body, sig)).toBe(true);
  });

  it("sin firma configurada devuelve el cuerpo igual", () => {
    expect(stripTrailingSignature("Hola", "")).toBe("Hola");
    expect(hasContentBeyondSignature("Hola", "")).toBe(true);
  });
});

describe("swapSignature", () => {
  it("cambia la firma antigua por la nueva al final del cuerpo", () => {
    const body = `Hola\n\n-- \nHola GallaDev`;
    expect(swapSignature(body, "Hola GallaDev", "Ociel")).toBe("Hola\n\n-- \nOciel");
  });

  it("cuerpo vacío sin firma previa recibe la nueva", () => {
    expect(swapSignature("", "", "Ociel")).toBe("\n\n-- \nOciel");
    expect(swapSignature("Texto", "", "Ociel")).toBe("Texto");
  });

  it("quita la firma si el nuevo buzón no tiene", () => {
    expect(swapSignature("Hola\n\n-- \nOciel", "Ociel", "")).toBe("Hola");
  });

  it("no toca el cuerpo si el usuario editó la firma", () => {
    const body = "Hola\n\n-- \nOciel (editada)";
    expect(swapSignature(body, "Ociel", "Otra")).toBe(body);
  });

  it("firmas iguales no cambian nada", () => {
    expect(swapSignature("Hola", "A", "A")).toBe("Hola");
  });
});

describe("parseSignatureText", () => {
  it("acepta texto y lo normaliza; vacío es válido", () => {
    expect(parseSignatureText("  Ociel\r\nGallaDev ")).toEqual({
      ok: true,
      value: "Ociel\nGallaDev",
    });
    expect(parseSignatureText("")).toEqual({ ok: true, value: "" });
  });

  it("rechaza no-texto, demasiado larga y caracteres de control", () => {
    expect(parseSignatureText(5).ok).toBe(false);
    expect(parseSignatureText("x".repeat(MAX_SIGNATURE_CHARS + 1)).ok).toBe(false);
    expect(parseSignatureText("a\u0000b").ok).toBe(false);
  });
});
