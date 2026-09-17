import {
  CONFIDENCE_LEVELS,
  LEAD_STATUSES,
  PROVINCES,
  SERVICES,
  isLeadStatus,
  type LeadCreateInput,
} from "@/lib/domain/lead";
import {
  normalizeDomain,
  normalizeEmail,
  normalizePhone,
} from "@/lib/leads/detect-duplicates";

export type LeadCreateField =
  | keyof LeadCreateInput
  | "_form";

export type LeadCreateErrors = Partial<Record<LeadCreateField, string>>;

export interface LeadCreateValidationResult {
  ok: boolean;
  errors: LeadCreateErrors;
  /** Normalized payload ready for persistence (URLs with protocol, trimmed strings). */
  value: LeadCreateInput | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\d\s.\-]{7,20}$/;

function emptyToNull(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t ? t : null;
}

export function normalizeWebsiteUrl(
  raw: string | null | undefined,
): string | null {
  const t = emptyToNull(raw);
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validate and normalize a manual lead create payload.
 * Shared by client UI and POST /api/leads.
 */
export function validateLeadCreate(
  raw: Partial<LeadCreateInput> | Record<string, unknown>,
): LeadCreateValidationResult {
  const errors: LeadCreateErrors = {};

  const companyName =
    typeof raw.companyName === "string" ? raw.companyName.trim() : "";
  if (companyName.length < 2) {
    errors.companyName = "La empresa es obligatoria (mín. 2 caracteres)";
  }

  const email = emptyToNull(
    typeof raw.email === "string" ? raw.email : null,
  );
  const phone = emptyToNull(
    typeof raw.phone === "string" ? raw.phone : null,
  );
  const websiteRaw =
    typeof raw.website === "string" ? raw.website : null;
  const website = normalizeWebsiteUrl(websiteRaw);

  if (!email && !phone && !website) {
    errors._form =
      "Indica al menos un canal de contacto: correo general, teléfono o web";
  }

  if (email && !EMAIL_RE.test(email)) {
    errors.email = "Correo no válido";
  }

  const emailCommercial = emptyToNull(
    typeof raw.emailCommercial === "string" ? raw.emailCommercial : null,
  );
  if (emailCommercial && !EMAIL_RE.test(emailCommercial)) {
    errors.emailCommercial = "Correo comercial no válido";
  }

  const emailManager = emptyToNull(
    typeof raw.emailManager === "string" ? raw.emailManager : null,
  );
  if (emailManager && !EMAIL_RE.test(emailManager)) {
    errors.emailManager = "Correo del gerente no válido";
  }

  if (phone && !PHONE_RE.test(phone)) {
    errors.phone = "Teléfono no válido";
  }

  if (websiteRaw?.trim() && (!website || !isValidUrl(website))) {
    errors.website = "URL no válida";
  }

  const linkedinRaw =
    typeof raw.linkedin === "string" ? raw.linkedin : null;
  const linkedin = normalizeWebsiteUrl(linkedinRaw);
  if (linkedinRaw?.trim() && (!linkedin || !isValidUrl(linkedin))) {
    errors.linkedin = "LinkedIn no válido";
  }

  let employees: number | null = null;
  if (
    raw.employees !== undefined &&
    raw.employees !== null &&
    !(typeof raw.employees === "string" && raw.employees.trim() === "")
  ) {
    const n =
      typeof raw.employees === "number"
        ? raw.employees
        : Number(raw.employees);
    if (!Number.isInteger(n) || n < 0) {
      errors.employees = "Empleados debe ser un entero ≥ 0";
    } else {
      employees = n;
    }
  }

  const provinceRaw = emptyToNull(
    typeof raw.province === "string" ? raw.province : null,
  );
  if (
    provinceRaw &&
    !(PROVINCES as readonly string[]).includes(provinceRaw)
  ) {
    errors.province = "Provincia no válida";
  }

  const confidenceRaw = emptyToNull(
    typeof raw.confidence === "string" ? raw.confidence : null,
  );
  if (
    confidenceRaw &&
    !(CONFIDENCE_LEVELS as readonly string[]).includes(confidenceRaw)
  ) {
    errors.confidence = "Nivel de confianza no válido";
  }

  let services: string[] = [];
  if (Array.isArray(raw.services)) {
    services = raw.services.filter(
      (s): s is string => typeof s === "string" && s.length > 0,
    );
    const invalid = services.filter(
      (s) => !(SERVICES as readonly string[]).includes(s),
    );
    if (invalid.length) {
      errors.services = `Servicios no válidos: ${invalid.join(", ")}`;
    }
  }

  const source = emptyToNull(
    typeof raw.source === "string" ? raw.source : null,
  );

  const emailSubject = emptyToNull(
    typeof raw.emailSubject === "string" ? raw.emailSubject : null,
  );
  const emailBody = emptyToNull(
    typeof raw.emailBody === "string" ? raw.emailBody : null,
  );
  const notesOverflow = emptyToNull(
    typeof raw.notesOverflow === "string" ? raw.notesOverflow : null,
  );

  let status: string | null = null;
  if (raw.status !== undefined && raw.status !== null && raw.status !== "") {
    const statusRaw =
      typeof raw.status === "string" ? raw.status.trim() : String(raw.status);
    if (!isLeadStatus(statusRaw)) {
      errors.status = `Estado no válido. Usa: ${(LEAD_STATUSES as readonly string[]).join(", ")}`;
    } else {
      status = statusRaw;
    }
  }

  let score: number | null = null;
  if (
    raw.score !== undefined &&
    raw.score !== null &&
    !(typeof raw.score === "string" && String(raw.score).trim() === "")
  ) {
    const n = typeof raw.score === "number" ? raw.score : Number(raw.score);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      errors.score = "Score debe ser un número entre 0 y 100";
    } else {
      score = Math.round(n);
    }
  }

  let discoveredAt: string | null = null;
  if (typeof raw.discoveredAt === "string" && raw.discoveredAt.trim()) {
    const d = new Date(raw.discoveredAt.trim());
    if (Number.isNaN(d.getTime())) {
      errors.discoveredAt = "discoveredAt no es una fecha válida (ISO)";
    } else {
      discoveredAt = d.toISOString();
    }
  }

  const value: LeadCreateInput = {
    companyName,
    website,
    email,
    emailCommercial,
    emailManager,
    phone,
    address: emptyToNull(
      typeof raw.address === "string" ? raw.address : null,
    ),
    postalCode: emptyToNull(
      typeof raw.postalCode === "string" ? raw.postalCode : null,
    ),
    city: emptyToNull(typeof raw.city === "string" ? raw.city : null),
    province: provinceRaw,
    employees,
    linkedin,
    services,
    manager: emptyToNull(
      typeof raw.manager === "string" ? raw.manager : null,
    ),
    role: emptyToNull(typeof raw.role === "string" ? raw.role : null),
    confidence: confidenceRaw,
    software: emptyToNull(
      typeof raw.software === "string" ? raw.software : null,
    ),
    notes: emptyToNull(typeof raw.notes === "string" ? raw.notes : null),
    favorite: Boolean(raw.favorite),
    source,
    status,
    emailSubject,
    emailBody,
    score,
    notesOverflow,
    discoveredAt,
  };

  const ok = Object.keys(errors).length === 0;
  return { ok, errors, value: ok ? value : null };
}

export function findLocalDuplicates(
  input: Pick<LeadCreateInput, "email" | "phone" | "website">,
  leads: { id: string; companyName: string; email: string | null; phone: string | null; website: string | null }[],
): { id: string; companyName: string; reason: string }[] {
  const domain = normalizeDomain(input.website);
  const email = normalizeEmail(input.email) ?? "";
  const phoneDigits = normalizePhone(input.phone) ?? "";

  const hits: { id: string; companyName: string; reason: string }[] = [];
  for (const l of leads) {
    if (email && normalizeEmail(l.email) === email) {
      hits.push({ id: l.id, companyName: l.companyName, reason: "mismo email" });
      continue;
    }
    const lPhone = normalizePhone(l.phone) ?? "";
    if (phoneDigits && lPhone && lPhone === phoneDigits) {
      hits.push({
        id: l.id,
        companyName: l.companyName,
        reason: "mismo teléfono",
      });
      continue;
    }
    if (domain && normalizeDomain(l.website) === domain) {
      hits.push({
        id: l.id,
        companyName: l.companyName,
        reason: "mismo dominio web",
      });
    }
  }
  return hits;
}
