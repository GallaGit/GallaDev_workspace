/**
 * Claves aceptadas por `SupabaseLeadRepository.get`.
 * UUID de la fila, o page id de Notion (32 hex) guardado en la migración.
 * Cualquier otra cadena no se consulta: así un id externo no entra en un filtro.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NOTION_PAGE_RE = /^[0-9a-f]{32}$/i;

export type LeadLookupColumn = "id" | "notion_page_id";

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function isNotionPageId(value: string): boolean {
  return NOTION_PAGE_RE.test(value);
}

/** Columnas a consultar con `.eq()`, en orden. Vacío si el id no tiene formato. */
export function leadLookupColumns(id: string): LeadLookupColumn[] {
  const value = id.trim();
  const columns: LeadLookupColumn[] = [];
  if (isUuid(value)) columns.push("id");
  if (isUuid(value) || isNotionPageId(value)) columns.push("notion_page_id");
  return columns;
}
