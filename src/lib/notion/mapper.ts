import type {
  PageObjectResponse,
  RichTextItemRequest,
  SelectColor,
} from "@notionhq/client/build/src/api-endpoints";
import type { TextRequest, StringRequest } from "@notionhq/client/build/src/api-endpoints/common";

type NotionPageProperty =
  | { title: Array<RichTextItemRequest>; type?: "title" }
  | { rich_text: Array<RichTextItemRequest>; type?: "rich_text" }
  | { number: number | null; type?: "number" }
  | { url: TextRequest | null; type?: "url" }
  | {
      select: {
        id: StringRequest;
        name?: TextRequest;
        color?: SelectColor;
        description?: TextRequest | null;
      } | {
        name: TextRequest;
        id?: StringRequest;
        color?: SelectColor;
        description?: TextRequest | null;
      } | null;
      type?: "select";
    }
  | {
      multi_select: Array<{
        id: StringRequest;
        name?: TextRequest;
        color?: SelectColor;
        description?: TextRequest | null;
      } | {
        name: TextRequest;
        id?: StringRequest;
        color?: SelectColor;
        description?: TextRequest | null;
      }>;
      type?: "multi_select";
    }
  | { email: TextRequest | null; type?: "email" }
  | { phone_number: TextRequest | null; type?: "phone_number" }
  | { date: { start: string; end?: string | null } | null; type?: "date" }
  | { checkbox: boolean; type?: "checkbox" }
  | {
      status: {
        id: StringRequest;
        name?: TextRequest;
        color?: SelectColor;
        description?: TextRequest | null;
      } | {
        name: TextRequest;
        id?: StringRequest;
        color?: SelectColor;
        description?: TextRequest | null;
      } | null;
      type?: "status";
    };

type NotionPageProperties = Record<string, NotionPageProperty>;

import {
  type Lead,
  type LeadCreateInput,
  type LeadPatch,
  type LeadStatus,
  type Province,
  normalizeStatus,
} from "@/lib/domain/lead";
import { canonicalizeCity } from "@/lib/geo/cities";
import { htmlEmailToPlain, splitNotes } from "@/lib/utils/email-plain";

type NotionPage = PageObjectResponse | { object: string; id: string };

function isFullPage(page: NotionPage): page is PageObjectResponse {
  return (
    "properties" in page &&
    (page as PageObjectResponse).object === "page" &&
    "url" in page
  );
}

function richText(
  prop: PageObjectResponse["properties"][string] | undefined,
): string | null {
  if (!prop) return null;
  if (prop.type === "rich_text") {
    const t = prop.rich_text.map((r) => r.plain_text).join("");
    return t || null;
  }
  if (prop.type === "title") {
    const t = prop.title.map((r) => r.plain_text).join("");
    return t || null;
  }
  return null;
}

function plainTextChunk(content: string) {
  return [{ type: "text" as const, text: { content: content.slice(0, 2000) } }];
}

function select(
  prop: PageObjectResponse["properties"][string] | undefined,
): string | null {
  if (!prop || prop.type !== "select") return null;
  return prop.select?.name ?? null;
}

function multiSelect(
  prop: PageObjectResponse["properties"][string] | undefined,
): string[] {
  if (!prop || prop.type !== "multi_select") return [];
  return prop.multi_select.map((o) => o.name);
}

function email(
  prop: PageObjectResponse["properties"][string] | undefined,
): string | null {
  if (!prop || prop.type !== "email") return null;
  return prop.email;
}

function phone(
  prop: PageObjectResponse["properties"][string] | undefined,
): string | null {
  if (!prop || prop.type !== "phone_number") return null;
  return prop.phone_number;
}

function url(
  prop: PageObjectResponse["properties"][string] | undefined,
): string | null {
  if (!prop || prop.type !== "url") return null;
  return prop.url;
}

function number(
  prop: PageObjectResponse["properties"][string] | undefined,
): number | null {
  if (!prop || prop.type !== "number") return null;
  return prop.number;
}

function checkbox(
  prop: PageObjectResponse["properties"][string] | undefined,
): boolean {
  if (!prop || prop.type !== "checkbox") return false;
  return prop.checkbox;
}

function dateStart(
  prop: PageObjectResponse["properties"][string] | undefined,
): string | null {
  if (!prop || prop.type !== "date") return null;
  return prop.date?.start ?? null;
}

export function mapNotionPageToLead(page: unknown): Lead | null {
  if (!page || typeof page !== "object") return null;
  if (!isFullPage(page as NotionPage)) return null;
  const full = page as PageObjectResponse;
  const p = full.properties;
  const city = richText(p["Ciudad"]);
  const rawEmailBody = richText(p["Email generado"]);

  const discoveredAt = dateStart(p["Fecha de descubrimiento"]) ?? full.created_time;

  return {
    id: full.id,
    url: full.url,
    companyName: richText(p["Empresa"]) ?? "Sin nombre",
    website: url(p["Web"]),
    email: email(p["Correo General"]),
    emailCommercial: email(p["Correo Comercial"]),
    emailManager: email(p["Correo Gerente"]),
    phone: phone(p["Teléfono"]),
    address: richText(p["Dirección"]),
    postalCode: richText(p["CP"]),
    city,
    cityCanonical: canonicalizeCity(city),
    province: select(p["Provincia"]) as Province | string | null,
    employees: number(p["Empleados"]),
    linkedin: url(p["LinkedIn"]),
    services: multiSelect(p["Servicios"]),
    status: normalizeStatus(select(p["Estado"])),
    lastActivity: dateStart(p["Última actualización"]),
    createdAt: discoveredAt,
    discoveredAt,
    notes: richText(p["Observaciones"]),
    notesOverflow: null,
    emailSubject: richText(p["Asunto email"]),
    emailBody: htmlEmailToPlain(rawEmailBody),
    score: number(p["Lead Score"]),
    manager: richText(p["Gerente"]),
    role: richText(p["Cargo"]),
    confidence: select(p["Confianza"]),
    software: richText(p["Software"]),
    source: richText(p["Origen"]),
    lastContact: dateStart(p["Último contacto"]),
    nextFollowUp: dateStart(p["Próximo seguimiento"]),
    favorite: checkbox(p["Favorito"]),
    aiAnalysis: richText(p["Análisis IA"]),
    lastEditedTime: full.last_edited_time,
    archived: Boolean(full.in_trash ?? full.archived),
  };
}

export function leadPatchToNotionProperties(
  patch: LeadPatch,
): NotionPageProperties {
  const props: NotionPageProperties = {};

  if (patch.companyName !== undefined) {
    props["Empresa"] = {
      title: plainTextChunk(patch.companyName || "Sin nombre"),
    };
  }
  if (patch.website !== undefined) {
    props["Web"] = { url: patch.website || null };
  }
  if (patch.email !== undefined) {
    props["Correo General"] = { email: patch.email || null };
  }
  if (patch.emailCommercial !== undefined) {
    props["Correo Comercial"] = { email: patch.emailCommercial || null };
  }
  if (patch.emailManager !== undefined) {
    props["Correo Gerente"] = { email: patch.emailManager || null };
  }
  if (patch.phone !== undefined) {
    props["Teléfono"] = { phone_number: patch.phone || null };
  }
  if (patch.address !== undefined) {
    props["Dirección"] = {
      rich_text: plainTextChunk(patch.address || ""),
    };
  }
  if (patch.postalCode !== undefined) {
    props["CP"] = { rich_text: plainTextChunk(patch.postalCode || "") };
  }
  if (patch.city !== undefined) {
    props["Ciudad"] = { rich_text: plainTextChunk(patch.city || "") };
  }
  if (patch.province !== undefined) {
    props["Provincia"] = patch.province
      ? { select: { name: patch.province } }
      : { select: null };
  }
  if (patch.employees !== undefined) {
    props["Empleados"] = { number: patch.employees };
  }
  if (patch.linkedin !== undefined) {
    props["LinkedIn"] = { url: patch.linkedin || null };
  }
  if (patch.services !== undefined) {
    props["Servicios"] = {
      multi_select: patch.services.map((name) => ({ name })),
    };
  }
  if (patch.status !== undefined) {
    const status: LeadStatus = normalizeStatus(patch.status);
    props["Estado"] = { select: { name: status } };
  }
  if (patch.notes !== undefined) {
    props["Observaciones"] = {
      rich_text: plainTextChunk(patch.notes || ""),
    };
  }
  if (patch.emailSubject !== undefined) {
    props["Asunto email"] = {
      rich_text: plainTextChunk(patch.emailSubject || ""),
    };
  }
  if (patch.emailBody !== undefined) {
    props["Email generado"] = {
      rich_text: plainTextChunk(patch.emailBody || ""),
    };
  }
  if (patch.score !== undefined) {
    props["Lead Score"] = { number: patch.score };
  }
  if (patch.manager !== undefined) {
    props["Gerente"] = { rich_text: plainTextChunk(patch.manager || "") };
  }
  if (patch.role !== undefined) {
    props["Cargo"] = { rich_text: plainTextChunk(patch.role || "") };
  }
  if (patch.confidence !== undefined) {
    props["Confianza"] = patch.confidence
      ? { select: { name: patch.confidence } }
      : { select: null };
  }
  if (patch.software !== undefined) {
    props["Software"] = { rich_text: plainTextChunk(patch.software || "") };
  }
  if (patch.source !== undefined) {
    props["Origen"] = { rich_text: plainTextChunk(patch.source || "") };
  }
  if (patch.lastContact !== undefined) {
    props["Último contacto"] = patch.lastContact
      ? { date: { start: patch.lastContact } }
      : { date: null };
  }
  if (patch.nextFollowUp !== undefined) {
    props["Próximo seguimiento"] = patch.nextFollowUp
      ? { date: { start: patch.nextFollowUp } }
      : { date: null };
  }
  if (patch.favorite !== undefined) {
    props["Favorito"] = { checkbox: patch.favorite };
  }
  if (patch.aiAnalysis !== undefined) {
    props["Análisis IA"] = {
      rich_text: plainTextChunk(patch.aiAnalysis || ""),
    };
  }

  props["Última actualización"] = {
    date: { start: new Date().toISOString().slice(0, 10) },
  };

  return props;
}

/** Map a validated create payload to Notion page properties (defaults included). */
export function leadCreateToNotionProperties(
  input: LeadCreateInput,
): { properties: NotionPageProperties; notesOverflow: string | null } {
  const today = new Date().toISOString().slice(0, 10);
  const notesValue = input.notes ?? "";
  const { observaciones, overflow } = splitNotes(notesValue);

  const properties = leadPatchToNotionProperties({
    companyName: input.companyName,
    website: input.website ?? null,
    email: input.email ?? null,
    emailCommercial: input.emailCommercial ?? null,
    emailManager: input.emailManager ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
    postalCode: input.postalCode ?? null,
    city: input.city ?? null,
    province: input.province ?? null,
    employees: input.employees ?? null,
    linkedin: input.linkedin ?? null,
    services: input.services ?? [],
    status: "Nuevo",
    notes: observaciones,
    manager: input.manager ?? null,
    role: input.role ?? null,
    confidence: input.confidence ?? null,
    software: input.software ?? null,
    source: input.source?.trim() || "Manual",
    favorite: Boolean(input.favorite),
  });

  properties["Fecha de descubrimiento"] = { date: { start: today } };
  properties["Última actualización"] = { date: { start: today } };

  return { properties, notesOverflow: overflow };
}

export function mapResultsToLeads(results: unknown[]): Lead[] {
  return results
    .map((r) => mapNotionPageToLead(r))
    .filter((l): l is Lead => l !== null);
}
