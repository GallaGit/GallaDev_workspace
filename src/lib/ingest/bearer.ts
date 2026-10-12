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
  /** `INGEST_SECRET` del formulario web. Vacío → la ruta responde 503. */
  form: string;
}

/** Solo `INGEST_SECRET` (la ingesta de n8n se retiró el 2026-10-10). */
export function ingestSecrets(): IngestSecretDecision {
  return { form: process.env.INGEST_SECRET?.trim() ?? "" };
}
