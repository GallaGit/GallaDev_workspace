import { formatAttachmentSize } from "./attachment-meta";

/**
 * Reglas de los adjuntos salientes (subidos desde el diálogo de redacción).
 * Sin dependencias de servidor: las comparten el navegador y las rutas.
 *
 * Los límites caben en el tope de 4,5 MB que Vercel aplica al cuerpo de una
 * función: el fichero viaja en la misma petición multipart que el correo.
 */

/** Máximo por fichero (3 MiB). */
export const MAX_OUTBOUND_ATTACHMENT_BYTES = 3 * 1024 * 1024;

/** Máximo sumando todos los ficheros de un correo (3,5 MiB). */
export const MAX_OUTBOUND_ATTACHMENTS_TOTAL_BYTES = 3.5 * 1024 * 1024;

/** Máximo de ficheros por correo. */
export const MAX_OUTBOUND_ATTACHMENTS = 10;

/** Extensiones ejecutables o de scripts: no se envían desde el buzón. */
export const BLOCKED_ATTACHMENT_EXTENSIONS = [
  "bat",
  "cmd",
  "com",
  "cpl",
  "dll",
  "exe",
  "jar",
  "js",
  "jse",
  "lnk",
  "msi",
  "ps1",
  "scr",
  "sh",
  "vbs",
  "wsf",
] as const;

export type AttachmentIssueCode =
  | "too-many"
  | "too-large"
  | "total-too-large"
  | "blocked"
  | "empty";

export type AttachmentValidation =
  | { ok: true }
  | { ok: false; code: AttachmentIssueCode; name?: string; error: string };

export function attachmentExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot < 0 ? "" : filename.slice(dot + 1).trim().toLowerCase();
}

export function isBlockedAttachmentName(filename: string): boolean {
  return (BLOCKED_ATTACHMENT_EXTENSIONS as readonly string[]).includes(
    attachmentExtension(filename),
  );
}

/** Nombre seguro: sin rutas, sin caracteres de control, máx. 120 caracteres. */
export function sanitizeAttachmentFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "").trim();
  const name = cleaned.replace(/^\.+/, "");
  if (!name) return "adjunto";
  if (name.length <= 120) return name;
  const ext = attachmentExtension(name);
  const keep = ext ? 120 - ext.length - 1 : 120;
  return ext ? `${name.slice(0, keep)}.${ext}` : name.slice(0, keep);
}

/** Content-Type utilizable; cualquier otra cosa pasa a octet-stream. */
export function safeAttachmentContentType(raw: string | null | undefined): string {
  const value = (raw ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  return /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(value)
    ? value
    : "application/octet-stream";
}

/** Valida el conjunto completo de adjuntos de un correo. */
export function validateAttachmentSet(
  files: ReadonlyArray<{ name: string; size: number }>,
): AttachmentValidation {
  if (files.length > MAX_OUTBOUND_ATTACHMENTS) {
    return {
      ok: false,
      code: "too-many",
      error: `Máximo ${MAX_OUTBOUND_ATTACHMENTS} adjuntos por correo`,
    };
  }
  let total = 0;
  for (const file of files) {
    if (isBlockedAttachmentName(file.name)) {
      return {
        ok: false,
        code: "blocked",
        name: file.name,
        error: `Tipo de archivo no permitido: ${file.name}`,
      };
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      return {
        ok: false,
        code: "empty",
        name: file.name,
        error: `El archivo está vacío: ${file.name}`,
      };
    }
    if (file.size > MAX_OUTBOUND_ATTACHMENT_BYTES) {
      return {
        ok: false,
        code: "too-large",
        name: file.name,
        error: `El archivo supera ${formatAttachmentSize(MAX_OUTBOUND_ATTACHMENT_BYTES)}: ${file.name}`,
      };
    }
    total += file.size;
  }
  if (total > MAX_OUTBOUND_ATTACHMENTS_TOTAL_BYTES) {
    return {
      ok: false,
      code: "total-too-large",
      error: `Los adjuntos superan ${formatAttachmentSize(MAX_OUTBOUND_ATTACHMENTS_TOTAL_BYTES)} en total`,
    };
  }
  return { ok: true };
}
