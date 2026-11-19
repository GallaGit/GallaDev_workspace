/**
 * Firma por buzón. Se añade al cuerpo al redactar y el usuario puede editarla
 * antes de enviar. Convención clásica de texto plano: línea «-- » y la firma.
 * Sin dependencias de servidor.
 */

export const MAX_SIGNATURE_CHARS = 2000;

const SEPARATOR = "-- ";

export function normalizeSignature(raw: string): string {
  return raw.replace(/\r\n?/g, "\n").trim().slice(0, MAX_SIGNATURE_CHARS);
}

/** Bloque que se añade al final del cuerpo: línea en blanco, «-- » y la firma. */
export function signatureBlock(signature: string): string {
  const sig = normalizeSignature(signature);
  return sig ? `\n\n${SEPARATOR}\n${sig}` : "";
}

/** Cuerpo inicial de un mensaje nuevo: espacio para escribir y luego la firma. */
export function initialBodyWithSignature(signature: string): string {
  return signatureBlock(signature);
}

/** Quita la firma si es lo último del cuerpo; si no, devuelve el cuerpo igual. */
export function stripTrailingSignature(body: string, signature: string): string {
  const block = signatureBlock(signature);
  if (!block) return body;
  const normalized = body.replace(/\r\n?/g, "\n").trimEnd();
  return normalized.endsWith(block) ? normalized.slice(0, -block.length) : body;
}

/** True si, quitada la firma, el cuerpo tiene algo escrito. */
export function hasContentBeyondSignature(body: string, signature: string): boolean {
  return stripTrailingSignature(body, signature).trim().length > 0;
}

/**
 * Cambia la firma antigua por la nueva (p. ej. al cambiar de buzón).
 * Si el usuario ha tocado el final del cuerpo y la firma antigua ya no está,
 * no se modifica nada.
 */
export function swapSignature(
  body: string,
  previous: string,
  next: string,
): string {
  const oldBlock = signatureBlock(previous);
  const newBlock = signatureBlock(next);
  if (oldBlock === newBlock) return body;
  if (!oldBlock) {
    return body.trim() === "" ? newBlock : body;
  }
  const normalized = body.replace(/\r\n?/g, "\n").trimEnd();
  if (!normalized.endsWith(oldBlock)) return body;
  return normalized.slice(0, -oldBlock.length) + newBlock;
}

export type SignaturePayloadResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

/** Valida el texto de firma recibido por API. Vacío = sin firma. */
export function parseSignatureText(raw: unknown): SignaturePayloadResult {
  if (typeof raw !== "string") {
    return { ok: false, error: "La firma debe ser texto" };
  }
  if (raw.length > MAX_SIGNATURE_CHARS * 2) {
    return { ok: false, error: "La firma es demasiado larga" };
  }
  const value = normalizeSignature(raw);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
    return { ok: false, error: "La firma contiene caracteres no válidos" };
  }
  if (raw.replace(/\r\n?/g, "\n").trim().length > MAX_SIGNATURE_CHARS) {
    return { ok: false, error: `La firma no puede superar ${MAX_SIGNATURE_CHARS} caracteres` };
  }
  return { ok: true, value };
}
