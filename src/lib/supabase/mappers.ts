import {
  type Lead,
  type LeadCreateInput,
  type LeadPatch,
  type LeadStatus,
  normalizeStatus,
} from "@/lib/domain/lead";
import { canonicalizeCity } from "@/lib/geo/cities";

/** Fila de public.leads tal cual la devuelve PostgREST (ver supabase/migrations/*_init_leads.sql). */
export interface LeadRow {
  id: string;
  notion_page_id: string | null;
  company_name: string;
  website: string | null;
  email: string | null;
  email_commercial: string | null;
  email_manager: string | null;
  phone: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  city_canonical: string | null;
  province: string | null;
  employees: number | null;
  linkedin: string | null;
  services: string[] | null;
  status: string;
  last_activity: string | null;
  discovered_at: string | null;
  notes: string | null;
  notes_overflow: string | null;
  email_subject: string | null;
  email_body: string | null;
  score: number | null;
  manager: string | null;
  role: string | null;
  confidence: string | null;
  software: string | null;
  source: string | null;
  last_contact: string | null;
  next_follow_up: string | null;
  favorite: boolean;
  ai_analysis: string | null;
  url: string | null;
  notion_last_edited_time: string | null;
  archived: boolean;
  tags: string[] | null;
  responsable: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const toDateOnly = (v: string | null): string | null => {
  if (!v) return null;
  return v.length >= 10 ? v.slice(0, 10) : v;
};

export function mapRowToLead(row: LeadRow): Lead {
  const city = row.city;
  return {
    id: row.id,
    url: row.url ?? "",
    companyName: row.company_name || "Sin nombre",
    website: row.website,
    email: row.email,
    emailCommercial: row.email_commercial,
    emailManager: row.email_manager,
    phone: row.phone,
    address: row.address,
    postalCode: row.postal_code,
    city,
    cityCanonical: row.city_canonical ?? canonicalizeCity(city),
    province: row.province,
    employees: row.employees,
    linkedin: row.linkedin,
    services: row.services ?? [],
    status: normalizeStatus(row.status),
    lastActivity: toDateOnly(row.last_activity),
    createdAt: row.discovered_at ?? row.created_at,
    discoveredAt: row.discovered_at ?? row.created_at,
    notes: row.notes,
    notesOverflow: row.notes_overflow,
    emailSubject: row.email_subject,
    emailBody: row.email_body,
    score: row.score,
    manager: row.manager,
    role: row.role,
    confidence: row.confidence,
    software: row.software,
    source: row.source,
    lastContact: toDateOnly(row.last_contact),
    nextFollowUp: toDateOnly(row.next_follow_up),
    favorite: Boolean(row.favorite),
    aiAnalysis: row.ai_analysis,
    lastEditedTime: row.notion_last_edited_time ?? row.updated_at,
    archived: Boolean(row.archived),
    responsibleId: row.responsable,
  };
}

export type LeadInsert = Omit<LeadRow, "created_at" | "updated_at" | "id"> &
  Partial<Pick<LeadRow, "id">>;

const today = () => new Date().toISOString().slice(0, 10);

export function leadCreateToRow(input: LeadCreateInput): LeadInsert {
  const city = input.city ?? null;
  return {
    company_name: input.companyName || "Sin nombre",
    website: input.website ?? null,
    email: input.email ?? null,
    email_commercial: input.emailCommercial ?? null,
    email_manager: input.emailManager ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
    postal_code: input.postalCode ?? null,
    city,
    city_canonical: canonicalizeCity(city),
    province: input.province ?? null,
    employees: input.employees ?? null,
    linkedin: input.linkedin ?? null,
    services: input.services ?? [],
    status: input.status ? normalizeStatus(input.status) : "Nuevo",
    last_activity: today(),
    discovered_at: input.discoveredAt?.trim() || new Date().toISOString(),
    notes: input.notes ?? null,
    notes_overflow: input.notesOverflow ?? null,
    manager: input.manager ?? null,
    role: input.role ?? null,
    confidence: input.confidence ?? null,
    software: input.software ?? null,
    source: input.source?.trim() || "Manual",
    favorite: Boolean(input.favorite),
    notion_page_id: null,
    email_subject: input.emailSubject ?? null,
    email_body: input.emailBody ?? null,
    score: input.score ?? null,
    last_contact: null,
    next_follow_up: null,
    ai_analysis: null,
    url: null,
    notion_last_edited_time: null,
    archived: false,
    tags: [],
    responsable: null,
  };
}

export function leadPatchToRow(patch: LeadPatch): Partial<LeadRow> {
  const row: Partial<LeadRow> = {};
  if (patch.companyName !== undefined)
    row.company_name = patch.companyName || "Sin nombre";
  if (patch.website !== undefined) row.website = patch.website || null;
  if (patch.email !== undefined) row.email = patch.email || null;
  if (patch.emailCommercial !== undefined)
    row.email_commercial = patch.emailCommercial || null;
  if (patch.emailManager !== undefined)
    row.email_manager = patch.emailManager || null;
  if (patch.phone !== undefined) row.phone = patch.phone || null;
  if (patch.address !== undefined) row.address = patch.address || null;
  if (patch.postalCode !== undefined)
    row.postal_code = patch.postalCode || null;
  if (patch.city !== undefined) {
    row.city = patch.city || null;
    row.city_canonical = canonicalizeCity(patch.city || null);
  }
  if (patch.province !== undefined) row.province = patch.province || null;
  if (patch.employees !== undefined) row.employees = patch.employees;
  if (patch.linkedin !== undefined) row.linkedin = patch.linkedin || null;
  if (patch.services !== undefined) row.services = patch.services;
  if (patch.status !== undefined)
    row.status = normalizeStatus(patch.status) satisfies LeadStatus;
  if (patch.notes !== undefined) row.notes = patch.notes || null;
  if (patch.emailSubject !== undefined)
    row.email_subject = patch.emailSubject || null;
  if (patch.emailBody !== undefined)
    row.email_body = patch.emailBody || null;
  if (patch.score !== undefined) row.score = patch.score;
  if (patch.manager !== undefined) row.manager = patch.manager || null;
  if (patch.role !== undefined) row.role = patch.role || null;
  if (patch.confidence !== undefined)
    row.confidence = patch.confidence || null;
  if (patch.software !== undefined) row.software = patch.software || null;
  if (patch.source !== undefined) row.source = patch.source || null;
  if (patch.lastContact !== undefined)
    row.last_contact = patch.lastContact || null;
  if (patch.nextFollowUp !== undefined)
    row.next_follow_up = patch.nextFollowUp || null;
  if (patch.favorite !== undefined) row.favorite = patch.favorite;
  if (patch.aiAnalysis !== undefined)
    row.ai_analysis = patch.aiAnalysis || null;
  if (patch.responsibleId !== undefined)
    row.responsable = patch.responsibleId || null;
  // Espejo de Notion: cada escritura refresca "Última actualización".
  row.last_activity = today();
  return row;
}
