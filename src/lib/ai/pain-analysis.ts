/**
 * Client-safe parse/format. Groq `analyzeBusinessPains` is in
 * `analyze-lead-pains.ts` (server-only + createGroqCompletion) so the drawer
 * can import this file.
 */
import type { Lead } from "@/lib/domain/lead";

export const PAIN_SECTION_LABELS = {
  evidence: "Evidencia",
  inference: "Inferencia",
  speculation: "Especulación",
} as const;

export type PainSectionKey = keyof typeof PAIN_SECTION_LABELS;

export interface PainAnalysis {
  evidence: string[];
  inference: string[];
  speculation: string[];
}

export const EMPTY_PAIN_ANALYSIS: PainAnalysis = {
  evidence: [],
  inference: [],
  speculation: [],
};

const SECTION_KEYS: PainSectionKey[] = [
  "evidence",
  "inference",
  "speculation",
];

const HEADING_ALIASES: Record<PainSectionKey, RegExp> = {
  evidence: /^(?:\*{0,2}|#{1,3}\s*)evidencia\b/i,
  inference: /^(?:\*{0,2}|#{1,3}\s*)inferencia\b/i,
  speculation: /^(?:\*{0,2}|#{1,3}\s*)especulaci[oó]n\b/i,
};

const NOTION_RICH_TEXT_LIMIT = 2000;

export function isPainAnalysisEmpty(analysis: PainAnalysis): boolean {
  return SECTION_KEYS.every((key) => analysis[key].length === 0);
}

export function normalizePainAnalysis(
  value:
    | Partial<Record<PainSectionKey, unknown>>
    | null
    | undefined,
): PainAnalysis {
  return {
    evidence: cleanItems(value?.evidence),
    inference: cleanItems(value?.inference),
    speculation: cleanItems(value?.speculation),
  };
}

export function formatPainAnalysis(analysis: PainAnalysis): string {
  const blocks = SECTION_KEYS.map((key) => {
    const items = analysis[key];
    const body =
      items.length > 0
        ? items.map((item) => `• ${item}`).join("\n")
        : "• —";
    return `${PAIN_SECTION_LABELS[key]}\n${body}`;
  });
  const text = blocks.join("\n\n").trim();
  if (text.length <= NOTION_RICH_TEXT_LIMIT) return text;
  return `${text.slice(0, NOTION_RICH_TEXT_LIMIT - 1).trimEnd()}…`;
}

export function parsePainAnalysis(text: string | null | undefined): PainAnalysis {
  const raw = text?.trim() ?? "";
  if (!raw) return { ...EMPTY_PAIN_ANALYSIS };

  const fromJson = parseJsonAnalysis(raw);
  if (fromJson && !isPainAnalysisEmpty(fromJson)) return fromJson;

  const fromHeadings = parseLabeledSections(raw);
  if (!isPainAnalysisEmpty(fromHeadings)) return fromHeadings;

  return { ...EMPTY_PAIN_ANALYSIS };
}

/** True when stored text has the three labeled sections (or JSON). */
export function hasStructuredPainAnalysis(
  text: string | null | undefined,
): boolean {
  return !isPainAnalysisEmpty(parsePainAnalysis(text));
}

/** Map the analyze API payload (Spanish or English keys) into UI blocks. */
export function fromApiPainAnalysis(value: unknown): PainAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const analysis = normalizePainAnalysis({
    evidence: asStringList(
      record.evidencia ?? record.evidence ?? record.Evidencia,
    ),
    inference: asStringList(
      record.inferencia ?? record.inference ?? record.Inferencia,
    ),
    speculation: asStringList(
      record.especulacion ?? record.speculation ?? record.Especulación,
    ),
  });
  return isPainAnalysisEmpty(analysis) ? null : analysis;
}

/** Prefer structured API analysis; else split the stored Notion string. */
export function resolvePainAnalysis(
  apiAnalysis: unknown,
  storedText: string | null | undefined,
): PainAnalysis | null {
  const fromApi = fromApiPainAnalysis(apiAnalysis);
  if (fromApi) return fromApi;
  const parsed = parsePainAnalysis(storedText);
  if (!isPainAnalysisEmpty(parsed)) return parsed;
  return null;
}

/** Enough raw signal to ask Groq; otherwise the UI shows the empty state. */
export function hasPainAnalysisSignal(lead: Lead): boolean {
  return Boolean(
    lead.website?.trim() ||
      lead.notes?.trim() ||
      lead.notesOverflow?.trim() ||
      lead.software?.trim() ||
      lead.services.some((service) => service.trim()),
  );
}

export function buildLeadFacts(lead: Lead): string {
  const lines: string[] = [];
  const add = (label: string, value: string | number | null | undefined) => {
    if (value == null) return;
    const text = String(value).trim();
    if (!text) return;
    lines.push(`${label}: ${text}`);
  };

  add("Empresa", lead.companyName);
  add("Web", lead.website);
  add("Ciudad", lead.cityCanonical ?? lead.city);
  add("Provincia", lead.province);
  add("Empleados", lead.employees);
  add("Servicios", lead.services.length ? lead.services.join(", ") : null);
  add("Software", lead.software);
  add("Estado CRM", lead.status);
  add("Gerente", lead.manager);
  add("Cargo", lead.role);
  add("Confianza extracción", lead.confidence);
  add("Origen", lead.source);
  add("Score", lead.score);
  add("Email general", lead.email);
  add("Teléfono", lead.phone);
  add("LinkedIn", lead.linkedin);
  add("Dirección", lead.address);
  add("Notas", lead.notes);
  if (lead.notesOverflow?.trim()) {
    add("Notas (continuación)", lead.notesOverflow);
  }

  if (lines.length === 0) {
    return "No hay campos con datos en este lead.";
  }
  return lines.join("\n");
}

function cleanItems(items: unknown): string[] {
  const list = Array.isArray(items)
    ? items
    : typeof items === "string"
      ? items.split(/\n+/)
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const text = item.replace(/^[•\-–—*]\s+/, "").trim();
    if (!text || text === "—") continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function parseJsonAnalysis(raw: string): PainAnalysis | null {
  const candidates = [raw, extractJsonPayload(raw)];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const analysis = coerceJsonAnalysis(parsed);
      if (analysis) return analysis;
    } catch {
      // try next candidate
    }
  }
  return null;
}

function extractJsonPayload(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return null;
}

function coerceJsonAnalysis(value: unknown): PainAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const analysis = normalizePainAnalysis({
    evidence: asStringList(
      record.evidence ?? record.evidencia ?? record.Evidencia,
    ),
    inference: asStringList(
      record.inference ?? record.inferencia ?? record.Inferencia,
    ),
    speculation: asStringList(
      record.speculation ?? record.especulacion ?? record.Especulación,
    ),
  });
  return isPainAnalysisEmpty(analysis) ? null : analysis;
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n+/)
      .map((line) => line.replace(/^[•\-–—*]\s+/, "").trim())
      .filter(Boolean);
  }
  return [];
}

function parseLabeledSections(raw: string): PainAnalysis {
  const analysis: PainAnalysis = {
    evidence: [],
    inference: [],
    speculation: [],
  };
  let current: PainSectionKey | null = null;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const heading = matchHeading(trimmed);
    if (heading) {
      current = heading.key;
      if (heading.rest) {
        analysis[current].push(...splitBulletLine(heading.rest));
      }
      continue;
    }

    if (current) {
      analysis[current].push(...splitBulletLine(trimmed));
    }
  }

  return normalizePainAnalysis(analysis);
}

function matchHeading(
  line: string,
): { key: PainSectionKey; rest: string } | null {
  const stripped = line.replace(/^\s*#{1,3}\s*/, "").replace(/\*/g, "").trim();
  for (const key of SECTION_KEYS) {
    if (!HEADING_ALIASES[key].test(stripped)) continue;
    const rest = stripped
      .replace(HEADING_ALIASES[key], "")
      .replace(/^[:.\s]+/, "")
      .trim();
    return { key, rest };
  }
  return null;
}

function splitBulletLine(line: string): string[] {
  const text = line.replace(/^[•\-–—*]\s+/, "").trim();
  return text ? [text] : [];
}
