import { describe, expect, it } from "vitest";
import {
  attachmentExtension,
  isBlockedAttachmentName,
  MAX_OUTBOUND_ATTACHMENT_BYTES,
  MAX_OUTBOUND_ATTACHMENTS,
  MAX_OUTBOUND_ATTACHMENTS_TOTAL_BYTES,
  safeAttachmentContentType,
  sanitizeAttachmentFilename,
  validateAttachmentSet,
} from "./outbound-attachments";

describe("attachmentExtension / isBlockedAttachmentName", () => {
  it("lee la extensión en minúsculas", () => {
    expect(attachmentExtension("Informe.PDF")).toBe("pdf");
    expect(attachmentExtension("sin-extension")).toBe("");
  });

  it("bloquea ejecutables y scripts, no documentos", () => {
    expect(isBlockedAttachmentName("setup.EXE")).toBe(true);
    expect(isBlockedAttachmentName("run.sh")).toBe(true);
    expect(isBlockedAttachmentName("factura.pdf")).toBe(false);
    expect(isBlockedAttachmentName("notas.txt")).toBe(false);
  });
});

describe("sanitizeAttachmentFilename", () => {
  it("quita rutas y caracteres de control", () => {
    expect(sanitizeAttachmentFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeAttachmentFilename("C:\\Users\\x\\doc.pdf")).toBe("doc.pdf");
    expect(sanitizeAttachmentFilename("a\r\nb\u0000.txt")).toBe("ab.txt");
  });

  it("no deja nombres vacíos ni ocultos", () => {
    expect(sanitizeAttachmentFilename("")).toBe("adjunto");
    expect(sanitizeAttachmentFilename("///")).toBe("adjunto");
    expect(sanitizeAttachmentFilename(".hidden")).toBe("hidden");
  });

  it("recorta a 120 caracteres conservando la extensión", () => {
    const out = sanitizeAttachmentFilename(`${"a".repeat(300)}.pdf`);
    expect(out).toHaveLength(120);
    expect(out.endsWith(".pdf")).toBe(true);
  });
});

describe("safeAttachmentContentType", () => {
  it("acepta tipos válidos y descarta parámetros", () => {
    expect(safeAttachmentContentType("application/pdf")).toBe("application/pdf");
    expect(safeAttachmentContentType("Text/Plain; charset=utf-8")).toBe("text/plain");
  });

  it("cae a octet-stream con basura o vacío", () => {
    expect(safeAttachmentContentType("")).toBe("application/octet-stream");
    expect(safeAttachmentContentType(null)).toBe("application/octet-stream");
    expect(safeAttachmentContentType("x\r\nBcc: a@b.c")).toBe("application/octet-stream");
  });
});

describe("validateAttachmentSet", () => {
  it("acepta un conjunto razonable", () => {
    expect(
      validateAttachmentSet([
        { name: "a.pdf", size: 1000 },
        { name: "b.png", size: MAX_OUTBOUND_ATTACHMENT_BYTES },
      ]),
    ).toEqual({ ok: true });
  });

  it("rechaza demasiados ficheros", () => {
    const files = Array.from({ length: MAX_OUTBOUND_ATTACHMENTS + 1 }, (_, i) => ({
      name: `f${i}.txt`,
      size: 10,
    }));
    expect(validateAttachmentSet(files)).toMatchObject({ ok: false, code: "too-many" });
  });

  it("rechaza ficheros bloqueados, vacíos y demasiado grandes", () => {
    expect(validateAttachmentSet([{ name: "x.exe", size: 10 }])).toMatchObject({
      ok: false,
      code: "blocked",
      name: "x.exe",
    });
    expect(validateAttachmentSet([{ name: "x.txt", size: 0 }])).toMatchObject({
      ok: false,
      code: "empty",
    });
    expect(
      validateAttachmentSet([{ name: "x.zip", size: MAX_OUTBOUND_ATTACHMENT_BYTES + 1 }]),
    ).toMatchObject({ ok: false, code: "too-large" });
  });

  it("rechaza si la suma supera el total", () => {
    const each = Math.floor(MAX_OUTBOUND_ATTACHMENTS_TOTAL_BYTES / 2) + 1;
    expect(
      validateAttachmentSet([
        { name: "a.bin", size: each },
        { name: "b.bin", size: each },
      ]),
    ).toMatchObject({ ok: false, code: "total-too-large" });
  });
});
