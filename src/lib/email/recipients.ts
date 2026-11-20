import {
  extractEmailAddress,
  isValidExternalEmail,
} from "./mailboxes";

/**
 * Listas de destinatarios (Para, Cc, Cco) del módulo Correo.
 * Sin dependencias de servidor: las usan el diálogo de redacción y las rutas.
 */

/** Tope por campo (Para, Cc, Cco). */
export const MAX_RECIPIENTS_PER_FIELD = 20;

/** Tope total por correo (el límite de Resend es 50 entre los tres campos). */
export const MAX_RECIPIENTS_TOTAL = 50;

/** Longitud máxima del texto de un campo de destinatarios en un borrador. */
export const MAX_RECIPIENT_FIELD_CHARS = 2000;

export type AddressListParse = {
  valid: string[];
  invalid: string[];
};

/** Parte un campo libre por comas, punto y coma o saltos de línea. */
export function splitAddressInput(raw: string): string[] {
  return raw
    .split(/[,;\n\r]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Valida y normaliza una lista de direcciones. Admite «Nombre <a@b.com>».
 * Devuelve las válidas en minúsculas y sin duplicados, y el texto de las que no.
 */
export function parseAddressList(raw: string | readonly string[]): AddressListParse {
  const parts = typeof raw === "string" ? splitAddressInput(raw) : [...raw];
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const part of parts) {
    const token = typeof part === "string" ? part.trim() : "";
    if (!token) continue;
    if (!isValidExternalEmail(token)) {
      invalid.push(token);
      continue;
    }
    const address = extractEmailAddress(token);
    if (!valid.includes(address)) valid.push(address);
  }
  return { valid, invalid };
}

export type RecipientFields = {
  to: string[];
  cc: string[];
  bcc: string[];
};

/**
 * Quita de Cc lo que ya está en Para, y de Cco lo que ya está en Para o Cc,
 * para no enviar dos veces a la misma persona.
 */
export function dedupeRecipients(fields: RecipientFields): RecipientFields {
  const to = [...new Set(fields.to)];
  const cc = [...new Set(fields.cc)].filter((a) => !to.includes(a));
  const bcc = [...new Set(fields.bcc)].filter(
    (a) => !to.includes(a) && !cc.includes(a),
  );
  return { to, cc, bcc };
}

export type RecipientListResult =
  | { ok: true; value: string[] }
  | { ok: false; error: string };

/**
 * Valida un campo Cc/Cco recibido por API: lista de strings o un string con
 * varias direcciones. Ausente o vacío = lista vacía.
 */
export function parseRecipientList(
  raw: unknown,
  label: string,
): RecipientListResult {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, value: [] };
  }
  if (typeof raw !== "string" && !Array.isArray(raw)) {
    return { ok: false, error: `${label} no válido` };
  }
  if (Array.isArray(raw) && raw.some((item) => typeof item !== "string")) {
    return { ok: false, error: `${label} no válido` };
  }
  if (typeof raw === "string" && raw.length > MAX_RECIPIENT_FIELD_CHARS) {
    return { ok: false, error: `${label} es demasiado largo` };
  }
  const { valid, invalid } = parseAddressList(raw as string | string[]);
  if (invalid.length > 0) {
    return { ok: false, error: `${label} no válido` };
  }
  if (valid.length > MAX_RECIPIENTS_PER_FIELD) {
    return { ok: false, error: `${label}: demasiados destinatarios` };
  }
  return { ok: true, value: valid };
}

/** True si la suma de destinatarios supera el tope por correo. */
export function exceedsRecipientTotal(fields: RecipientFields): boolean {
  return fields.to.length + fields.cc.length + fields.bcc.length > MAX_RECIPIENTS_TOTAL;
}
