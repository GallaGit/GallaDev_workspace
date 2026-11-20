import "server-only";

import { readCappedJson } from "@/lib/rate-limit";
import { EMAIL_JSON_MAX_BYTES } from "./limits";
import type { OutboundAttachment } from "./outbound-attachments-store";
import {
  MAX_OUTBOUND_ATTACHMENTS,
  MAX_OUTBOUND_ATTACHMENTS_TOTAL_BYTES,
  safeAttachmentContentType,
  sanitizeAttachmentFilename,
  validateAttachmentSet,
} from "./outbound-attachments";

/**
 * Cuerpo de las rutas que envían correo (compose, reply, forward).
 *
 * - `application/json`: como siempre, sin adjuntos.
 * - `multipart/form-data`: campo `payload` (el mismo JSON) y campos `files`
 *   (los adjuntos). Se lee con tope de bytes antes de parsear.
 */

/** Campo del formulario con el JSON del correo. */
export const PAYLOAD_FIELD = "payload";
/** Campo del formulario con cada adjunto. */
export const FILES_FIELD = "files";

/** Tope del cuerpo multipart completo: adjuntos + JSON + márgenes del formato. */
export const OUTBOUND_MULTIPART_MAX_BYTES =
  MAX_OUTBOUND_ATTACHMENTS_TOTAL_BYTES + EMAIL_JSON_MAX_BYTES + 256 * 1024;

export type OutboundRequestResult =
  | { ok: true; json: unknown; attachments: OutboundAttachment[] }
  | { ok: false; status: number; error: string };

export function isMultipart(request: Request): boolean {
  return (request.headers.get("content-type") ?? "")
    .toLowerCase()
    .startsWith("multipart/form-data");
}

async function readBodyCapped(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array | null> {
  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxBytes) return null;
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readOutboundRequest(
  request: Request,
  tooLongMessage: string,
): Promise<OutboundRequestResult> {
  if (!isMultipart(request)) {
    const read = await readCappedJson(request, EMAIL_JSON_MAX_BYTES);
    if (!read.ok) {
      return {
        ok: false,
        status: read.status,
        error: read.status === 413 ? tooLongMessage : "Datos del correo no válidos",
      };
    }
    return { ok: true, json: read.value, attachments: [] };
  }

  const bytes = await readBodyCapped(request, OUTBOUND_MULTIPART_MAX_BYTES);
  if (!bytes) {
    return { ok: false, status: 413, error: "Los adjuntos son demasiado grandes" };
  }

  let form: FormData;
  try {
    form = await new Response(bytes as BodyInit, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    return { ok: false, status: 400, error: "Datos del correo no válidos" };
  }

  const payload = form.get(PAYLOAD_FIELD);
  if (typeof payload !== "string" || payload.length > EMAIL_JSON_MAX_BYTES) {
    return { ok: false, status: 400, error: "Datos del correo no válidos" };
  }
  let json: unknown;
  try {
    json = JSON.parse(payload || "{}");
  } catch {
    return { ok: false, status: 400, error: "Datos del correo no válidos" };
  }

  const entries = form.getAll(FILES_FIELD);
  if (entries.length > MAX_OUTBOUND_ATTACHMENTS) {
    return {
      ok: false,
      status: 400,
      error: `Máximo ${MAX_OUTBOUND_ATTACHMENTS} adjuntos por correo`,
    };
  }
  const files: File[] = [];
  for (const entry of entries) {
    if (typeof entry === "string") {
      return { ok: false, status: 400, error: "Datos del correo no válidos" };
    }
    files.push(entry);
  }

  const checked = validateAttachmentSet(
    files.map((file) => ({ name: file.name, size: file.size })),
  );
  if (!checked.ok) return validationError(checked);

  const attachments: OutboundAttachment[] = [];
  for (const file of files) {
    attachments.push({
      filename: sanitizeAttachmentFilename(file.name),
      contentType: safeAttachmentContentType(file.type),
      content: Buffer.from(await file.arrayBuffer()),
    });
  }
  return { ok: true, json, attachments };
}

function validationError(
  result: ReturnType<typeof validateAttachmentSet>,
): OutboundRequestResult {
  return {
    ok: false,
    status:
      !result.ok && (result.code === "too-large" || result.code === "total-too-large")
        ? 413
        : 400,
    error: result.ok ? "Datos del correo no válidos" : result.error,
  };
}
