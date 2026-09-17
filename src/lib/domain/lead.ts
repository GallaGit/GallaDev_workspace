export const LEAD_STATUSES = [
  "Nuevo",
  "Pendiente revisar",
  "Validado",
  "Email preparado",
  "Email enviado",
  "Respondió",
  "Reunión",
  "Cliente",
  "Descartado",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEGACY_STATUS_MAP: Record<string, LeadStatus> = {
  Pendiente: "Pendiente revisar",
  Contactado: "Email enviado",
  Contratado: "Cliente",
};

export const PROVINCES = ["Valencia", "Alicante", "Castellón", "Otra"] as const;
export type Province = (typeof PROVINCES)[number];

export const SERVICES = [
  "Fiscal",
  "Laboral",
  "Contable",
  "Jurídico",
  "Gestoría",
  "Mercantil",
] as const;
export type Service = (typeof SERVICES)[number];

export const CONFIDENCE_LEVELS = ["Alta", "Media", "Baja"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export interface Lead {
  id: string;
  url: string;
  companyName: string;
  website: string | null;
  email: string | null;
  emailCommercial: string | null;
  emailManager: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  cityCanonical: string | null;
  province: Province | string | null;
  employees: number | null;
  linkedin: string | null;
  services: string[];
  status: LeadStatus;
  lastActivity: string | null;
  createdAt: string | null;
  discoveredAt?: string | null;
  notes: string | null;
  notesOverflow: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  score: number | null;
  manager: string | null;
  role: string | null;
  confidence: Confidence | string | null;
  software: string | null;
  source: string | null;
  lastContact: string | null;
  nextFollowUp: string | null;
  favorite: boolean;
  aiAnalysis: string | null;
  lastEditedTime: string | null;
  archived: boolean;
}

export type LeadPatch = Partial<
  Pick<
    Lead,
    | "companyName"
    | "website"
    | "email"
    | "emailCommercial"
    | "emailManager"
    | "phone"
    | "address"
    | "postalCode"
    | "city"
    | "province"
    | "employees"
    | "linkedin"
    | "services"
    | "status"
    | "notes"
    | "notesOverflow"
    | "emailSubject"
    | "emailBody"
    | "score"
    | "manager"
    | "role"
    | "confidence"
    | "software"
    | "source"
    | "lastContact"
    | "nextFollowUp"
    | "favorite"
    | "aiAnalysis"
  >
>;

/** Payload for creating a lead manually from Leads_CRM. */
export interface LeadCreateInput {
  companyName: string;
  website?: string | null;
  email?: string | null;
  emailCommercial?: string | null;
  emailManager?: string | null;
  phone?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  province?: Province | string | null;
  employees?: number | null;
  linkedin?: string | null;
  services?: string[];
  manager?: string | null;
  role?: string | null;
  confidence?: Confidence | string | null;
  software?: string | null;
  notes?: string | null;
  favorite?: boolean;
  /**
   * Origen del lead. Por defecto los mappers usan "Manual".
   * La ingesta pública (form galladev.com) pasa "web-galladev".
   * POST /api/ingest/n8n usa "n8n" si no viene source.
   */
  source?: string | null;
  /** Campos ricos opcionales (p.ej. prospectos n8n). No los usa el diálogo manual. */
  status?: LeadStatus | string | null;
  emailSubject?: string | null;
  emailBody?: string | null;
  score?: number | null;
  notesOverflow?: string | null;
  discoveredAt?: string | null;
}

export interface ActivityEvent {
  id: string;
  at: string;
  type: string;
  message: string;
}

/** Timeline type for Detectar dolores. Matches `lead_analyzed` (event), not `ai_analysis`. */
export const ACTIVITY_TYPE_AI_ANALYZED = "ai_analyzed";

export interface LeadFilters {
  search?: string;
  status?: LeadStatus[];
  province?: string[];
  city?: string[];
  employeesMin?: number | null;
  employeesMax?: number | null;
  createdFrom?: string | null;
  createdTo?: string | null;
  activityFrom?: string | null;
  activityTo?: string | null;
  hasEmail?: boolean | null;
  hasPhone?: boolean | null;
  hasWebsite?: boolean | null;
  hasLinkedin?: boolean | null;
  favorite?: boolean | null;
}

export function isLeadStatus(value: unknown): value is LeadStatus {
  return (
    typeof value === "string" &&
    (LEAD_STATUSES as readonly string[]).includes(value)
  );
}

export function normalizeStatus(raw: string | null | undefined): LeadStatus {
  if (!raw) return "Nuevo";
  if (isLeadStatus(raw)) return raw;
  return LEGACY_STATUS_MAP[raw] ?? "Pendiente revisar";
}
