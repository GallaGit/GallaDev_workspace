import { z } from "zod";

/**
 * Búsqueda en Correo (FTS de Postgres sobre `search_tsv`).
 *
 * El texto del usuario nunca llega crudo a `to_tsquery`: se parte en palabras
 * (letras y números Unicode) y se arma `palabra:* & palabra:*`. Así no hay
 * errores de sintaxis de tsquery ni operadores inyectados (`|`, `!`, `<->`,
 * paréntesis, comillas). PostgREST lo envía como parámetro, no como SQL.
 */

export const MAX_SEARCH_CHARS = 200;
export const MAX_SEARCH_TERMS = 8;
const MAX_TERM_CHARS = 64;
/** Tope de hilos candidatos por búsqueda (mantiene corta la URL del `in`). */
export const MAX_SEARCH_THREADS = 200;

export const SEARCH_SCOPES = ["view", "all"] as const;
export type SearchScope = (typeof SEARCH_SCOPES)[number];

const searchQuerySchema = z
  .string({ error: "Búsqueda no válida" })
  .max(MAX_SEARCH_CHARS * 4, { error: "La búsqueda es demasiado larga" })
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .refine((value) => value.length <= MAX_SEARCH_CHARS, {
    error: "La búsqueda es demasiado larga",
  });

export type SearchQueryResult =
  | { ok: true; q: string | null }
  | { ok: false; error: string };

/** Valida `q`: vacío/ausente = sin búsqueda; máx. 200 caracteres. */
export function parseSearchQuery(raw: string | null | undefined): SearchQueryResult {
  if (raw == null) return { ok: true, q: null };
  const parsed = searchQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Búsqueda no válida" };
  }
  return { ok: true, q: parsed.data.length > 0 ? parsed.data : null };
}

export function parseSearchScope(raw: string | null | undefined): SearchScope {
  return raw?.trim().toLowerCase() === "all" ? "all" : "view";
}

/** Palabras buscables: letras/números Unicode, en minúscula, sin repetir. */
export function searchTerms(q: string): string[] {
  const words = q.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const unique: string[] = [];
  for (const word of words) {
    const term = word.slice(0, MAX_TERM_CHARS);
    if (!unique.includes(term)) unique.push(term);
    if (unique.length >= MAX_SEARCH_TERMS) break;
  }
  return unique;
}

/**
 * tsquery seguro con prefijo: «ana presup» → `ana:* & presup:*`.
 * null si no queda ninguna palabra (p. ej. solo símbolos).
 */
export function buildTsQuery(q: string): string | null {
  const terms = searchTerms(q);
  if (terms.length === 0) return null;
  return terms.map((term) => `${term}:*`).join(" & ");
}
