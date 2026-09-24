import { z } from "zod";
import {
  CONFIDENCE_LEVELS,
  LEAD_STATUSES,
  PROVINCES,
  SERVICES,
  type LeadPatch,
} from "@/lib/domain/lead";
import { normalizeWebsiteUrl } from "@/lib/leads/validate-lead";

/**
 * Validación de cuerpos PATCH de leads.
 *
 * El conjunto de campos es `LeadPatch` (parcial). Las reglas de formato,
 * enums y rangos son las mismas que `validateLeadCreate` cuando el campo
 * viene en el cuerpo: un PATCH válido se reenvía tal cual al repositorio
 * (sin reescribir URLs ni recortar textos).
 */

export const INVALID_LEAD_PATCH = "Datos del lead no válidos";
export const BULK_PATCH_REQUIRED = "ids y patch requeridos";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\d\s.\-]{7,20}$/;

const STATUS_ERROR = `Estado no válido. Usa: ${LEAD_STATUSES.join(", ")}`;

export type LeadPatchFieldErrors = Record<string, string>;

export type LeadPatchValidation =
  | { ok: true; value: LeadPatch }
  | { ok: false; error: string; fieldErrors: LeadPatchFieldErrors };

export type BulkLeadPatchValidation =
  | { ok: true; value: { ids: string[]; patch: LeadPatch } }
  | { ok: false; error: string; fieldErrors: LeadPatchFieldErrors };

function isAcceptableUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  const normalized = normalizeWebsiteUrl(trimmed);
  if (!normalized) return false;
  try {
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function objectError(issue: {
  code?: string;
  keys?: readonly string[];
  expected?: unknown;
}): string | undefined {
  if (issue.code === "unrecognized_keys") {
    return `Campo no permitido: ${(issue.keys ?? []).join(", ")}`;
  }
  if (issue.code === "invalid_type" && issue.expected === "object") {
    return "El cuerpo debe ser un objeto JSON";
  }
  return undefined;
}

function nullableText(typeMessage: string) {
  return z.string({ error: typeMessage }).nullable();
}

function nullableFormat(
  typeMessage: string,
  formatMessage: string,
  accept: (value: string) => boolean,
) {
  return nullableText(typeMessage).refine(
    (value) => value == null || value.trim() === "" || accept(value),
    { error: formatMessage },
  );
}

function closedString(values: readonly [string, ...string[]], message: string) {
  return z.union([z.literal(""), z.enum(values), z.null()], { error: message });
}

const servicesField = z
  .array(z.string({ error: "Servicios debe ser una lista de textos" }), {
    error: "Servicios debe ser una lista",
  })
  .superRefine((items, ctx) => {
    const invalid = items.filter(
      (item) => !(SERVICES as readonly string[]).includes(item),
    );
    if (invalid.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: `Servicios no válidos: ${invalid.join(", ")}`,
      });
    }
  });

export const leadPatchSchema = z.strictObject(
  {
    companyName: z.string({ error: "La empresa debe ser texto" }).optional(),
    website: nullableFormat(
      "La web debe ser texto",
      "URL no válida",
      isAcceptableUrl,
    ).optional(),
    email: nullableFormat(
      "El correo debe ser texto",
      "Correo no válido",
      (value) => EMAIL_RE.test(value.trim()),
    ).optional(),
    emailCommercial: nullableFormat(
      "El correo comercial debe ser texto",
      "Correo comercial no válido",
      (value) => EMAIL_RE.test(value.trim()),
    ).optional(),
    emailManager: nullableFormat(
      "El correo del gerente debe ser texto",
      "Correo del gerente no válido",
      (value) => EMAIL_RE.test(value.trim()),
    ).optional(),
    phone: nullableFormat(
      "El teléfono debe ser texto",
      "Teléfono no válido",
      (value) => PHONE_RE.test(value.trim()),
    ).optional(),
    address: nullableText("La dirección debe ser texto").optional(),
    postalCode: nullableText("El código postal debe ser texto").optional(),
    city: nullableText("La ciudad debe ser texto").optional(),
    province: closedString(PROVINCES, "Provincia no válida").optional(),
    employees: z
      .number({ error: "Empleados debe ser un entero ≥ 0" })
      .int()
      .nonnegative()
      .nullable()
      .optional(),
    linkedin: nullableFormat(
      "LinkedIn debe ser texto",
      "LinkedIn no válido",
      isAcceptableUrl,
    ).optional(),
    services: servicesField.optional(),
    status: z.enum(LEAD_STATUSES, { error: STATUS_ERROR }).optional(),
    notes: nullableText("Las notas deben ser texto").optional(),
    notesOverflow: nullableText("Las notas deben ser texto").optional(),
    emailSubject: nullableText("El asunto debe ser texto").optional(),
    emailBody: nullableText("El cuerpo del email debe ser texto").optional(),
    score: z
      .number({ error: "Score debe ser un número entre 0 y 100" })
      .min(0)
      .max(100)
      .nullable()
      .optional(),
    manager: nullableText("El gerente debe ser texto").optional(),
    role: nullableText("El cargo debe ser texto").optional(),
    confidence: closedString(
      CONFIDENCE_LEVELS,
      "Nivel de confianza no válido",
    ).optional(),
    software: nullableText("El software debe ser texto").optional(),
    source: nullableText("El origen debe ser texto").optional(),
    lastContact: nullableText("La última fecha de contacto debe ser texto").optional(),
    nextFollowUp: nullableText("La próxima fecha de seguimiento debe ser texto").optional(),
    favorite: z.boolean({ error: "Favorito debe ser sí o no" }).optional(),
    aiAnalysis: nullableText("El análisis debe ser texto").optional(),
    responsibleId: nullableText("El responsable debe ser texto").optional(),
  },
  { error: objectError },
);

const bulkLeadPatchSchema = z.strictObject(
  {
    ids: z
      .array(
        z
          .string({ error: "Cada id debe ser texto" })
          .min(1, { error: "Cada id debe ser texto no vacío" }),
        { error: "ids debe ser una lista de identificadores" },
      )
      .min(1, { error: BULK_PATCH_REQUIRED }),
    patch: leadPatchSchema,
  },
  { error: objectError },
);

function toFieldErrors(error: z.ZodError): LeadPatchFieldErrors {
  const fieldErrors: LeadPatchFieldErrors = {};
  for (const issue of error.issues) {
    if (issue.code === "unrecognized_keys") {
      const prefix = issue.path.map(String).filter(Boolean).join(".");
      for (const key of issue.keys) {
        const field = prefix ? `${prefix}.${key}` : key;
        if (!fieldErrors[field]) fieldErrors[field] = "Campo no permitido";
      }
      continue;
    }
    const field =
      issue.path
        .filter((segment) => typeof segment !== "number")
        .map(String)
        .join(".") || "_form";
    if (!fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return fieldErrors;
}

function bulkTopError(
  raw: unknown,
  fieldErrors: LeadPatchFieldErrors,
): string {
  const hasInnerPatchError = Object.keys(fieldErrors).some((key) =>
    key.startsWith("patch."),
  );
  if (hasInnerPatchError) return INVALID_LEAD_PATCH;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return INVALID_LEAD_PATCH;
  }
  const body = raw as Record<string, unknown>;
  const idsMissing =
    !Array.isArray(body.ids) || body.ids.length === 0;
  const patchMissing =
    body.patch == null ||
    typeof body.patch !== "object" ||
    Array.isArray(body.patch);
  if (idsMissing || patchMissing) return BULK_PATCH_REQUIRED;
  return INVALID_LEAD_PATCH;
}

export function validateLeadPatch(raw: unknown): LeadPatchValidation {
  const parsed = leadPatchSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: INVALID_LEAD_PATCH,
      fieldErrors: toFieldErrors(parsed.error),
    };
  }
  return { ok: true, value: parsed.data };
}

export function validateBulkLeadPatch(raw: unknown): BulkLeadPatchValidation {
  const parsed = bulkLeadPatchSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = toFieldErrors(parsed.error);
    return {
      ok: false,
      error: bulkTopError(raw, fieldErrors),
      fieldErrors,
    };
  }
  return { ok: true, value: parsed.data };
}
