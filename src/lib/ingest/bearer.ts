import { createHash, timingSafeEqual } from "node:crypto";

export function readBearer(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return (match?.[1] ?? "").trim();
}

/** Compara el digest, no la cadena: longitudes distintas no salen antes. */
export function bearerMatches(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const left = createHash("sha256").update(provided, "utf8").digest();
  const right = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(left, right);
}

export interface IngestSecretDecision {
  form: string;
  /** Secreto que acepta `/api/ingest/n8n`. Vacío si hay que responder 503. */
  n8n: string;
  /** `N8N_INGEST_SECRET` está definido y es igual a `INGEST_SECRET`. */
  n8nMisconfigured: boolean;
}

/**
 * Formulario: solo `INGEST_SECRET` (503 si falta).
 * n8n: `N8N_INGEST_SECRET` si está y es distinto. Si no está, el mismo
 * `INGEST_SECRET` para no cortar la ingesta ya desplegada. Si está y coincide
 * con el del formulario, 503: no hay separación.
 */
export function ingestSecrets(): IngestSecretDecision {
  const form = process.env.INGEST_SECRET?.trim() ?? "";
  const dedicated = process.env.N8N_INGEST_SECRET?.trim() ?? "";
  if (!dedicated) {
    return { form, n8n: form, n8nMisconfigured: false };
  }
  if (dedicated === form) {
    return { form, n8n: "", n8nMisconfigured: true };
  }
  return { form, n8n: dedicated, n8nMisconfigured: false };
}
