/**
 * Ingesta pública de leads (formulario galladev.com → POST /api/ingest/lead).
 *
 * Lógica pura (sin Next, sin repo) para poder testearla con vitest.
 * Límites espejo de la landing (GallaDev/index.html + main.js):
 * nombre 2–100, email válido ≤320, empresa ≤100 (opcional), mensaje 20–2000.
 */

import type { LeadCreateInput } from "@/lib/domain/lead";

export const INGEST_SOURCE = "web-galladev";

export const INGEST_NAME_MIN = 2;
export const INGEST_NAME_MAX = 100;
export const INGEST_EMAIL_MAX = 320;
export const INGEST_COMPANY_MAX = 100;
export const INGEST_MSG_MIN = 20;
export const INGEST_MSG_MAX = 2000;

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/;
const NAME_RE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’\-.\s]+$/;

export interface IngestPayload {
  name: unknown;
  email: unknown;
  company?: unknown;
  message: unknown;
  origin?: unknown;
}

export type IngestField = "name" | "email" | "company" | "message" | "origin";
export type IngestErrors = Partial<Record<IngestField, string>>;

export interface IngestValidation {
  ok: boolean;
  errors: IngestErrors;
  /** Payload normalizado listo para mapear (solo si ok). */
  value: {
    name: string;
    email: string;
    company: string;
    message: string;
  } | null;
}

function cleanSpaces(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function validateIngest(raw: Record<string, unknown>): IngestValidation {
  const errors: IngestErrors = {};

  const name = cleanSpaces(raw.name);
  if (!name) {
    errors.name = "Nombre requerido";
  } else if (name.length < INGEST_NAME_MIN) {
    errors.name = "El nombre debe tener al menos 2 caracteres";
  } else if (name.length > INGEST_NAME_MAX || !NAME_RE.test(name)) {
    errors.name = "Revisa el nombre: máximo 100 caracteres, solo letras";
  }

  const email = String(raw.email ?? "").trim().toLowerCase();
  if (!email) {
    errors.email = "Email requerido";
  } else if (email.length > INGEST_EMAIL_MAX || !EMAIL_RE.test(email)) {
    errors.email = "Email no válido";
  }

  const company = cleanSpaces(raw.company);
  if (company.length > INGEST_COMPANY_MAX) {
    errors.company = "La empresa no puede superar los 100 caracteres";
  }

  const message = String(raw.message ?? "").trim();
  if (!message) {
    errors.message = "Mensaje requerido";
  } else if (message.length < INGEST_MSG_MIN) {
    errors.message = "El mensaje debe tener al menos 20 caracteres";
  } else if (message.length > INGEST_MSG_MAX) {
    errors.message = "El mensaje no puede superar los 2000 caracteres";
  }

  const origin = String(raw.origin ?? "").trim();
  if (origin && origin !== INGEST_SOURCE) {
    errors.origin = "Origen no reconocido";
  }

  const ok = Object.keys(errors).length === 0;
  return {
    ok,
    errors,
    value: ok ? { name, email, company, message } : null,
  };
}

/**
 * Mapeo landing → lead interno.
 * companyName: empresa si viene, si no el propio nombre (campo obligatorio interno).
 * El mensaje se guarda en notes; el origen viaja en source.
 */
export function mapIngestToLeadCreate(value: {
  name: string;
  email: string;
  company: string;
  message: string;
}): LeadCreateInput {
  return {
    companyName: value.company || value.name,
    email: value.email,
    manager: value.name,
    notes: value.message,
    source: INGEST_SOURCE,
  };
}

/** Anexa un mensaje web a las notas existentes (fusión de duplicados). */
export function appendIngestNote(
  existingNotes: string | null,
  message: string,
  at: Date = new Date(),
): string {
  const stamp = `[${INGEST_SOURCE} · ${at.toISOString().slice(0, 10)}]`;
  const entry = `${stamp}\n${message}`;
  return existingNotes?.trim() ? `${existingNotes.trim()}\n\n${entry}` : entry;
}
