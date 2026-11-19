/**
 * Cuerpo de las peticiones de envío desde el navegador (compose, reply, forward).
 * Sin adjuntos: JSON, como siempre. Con adjuntos: multipart con el JSON en
 * `payload` y cada fichero en `files` (ver `outbound-request.ts`).
 * Sin dependencias de servidor.
 */

export const OUTBOUND_PAYLOAD_FIELD = "payload";
export const OUTBOUND_FILES_FIELD = "files";

export function buildOutboundInit(
  payload: Record<string, unknown>,
  files: readonly File[],
): RequestInit {
  if (files.length === 0) {
    return {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    };
  }
  const form = new FormData();
  form.append(OUTBOUND_PAYLOAD_FIELD, JSON.stringify(payload));
  for (const file of files) form.append(OUTBOUND_FILES_FIELD, file, file.name);
  // Sin Content-Type: el navegador añade el boundary del multipart.
  return { method: "POST", body: form };
}
