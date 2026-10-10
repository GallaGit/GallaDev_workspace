/**
 * Utilidades puras de hilos (sin I/O): Message-ID, References y asunto.
 *
 * Causa del bug de hilos partidos: Resend (SES) sustituye nuestro Message-ID
 * en el envío. El destinatario ve `<…@eu-west-1.amazonses.com>` y su
 * respuesta lleva ese id en In-Reply-To, pero guardábamos `<uuid@galladev.com>`.
 * Ahora guardamos el message_id real que devuelve `emails.get` y, si falta,
 * hay respaldo por asunto normalizado + misma contraparte.
 */

/** Normaliza un Message-ID a `<id>` en minúsculas; null si está vacío. */
export function normalizeMessageId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const inner = raw.trim().replace(/^<+/, "").replace(/>+$/, "").trim();
  if (!inner || /\s/.test(inner)) return null;
  return `<${inner.toLowerCase()}>`;
}

/**
 * Extrae los Message-ID de una cabecera References / In-Reply-To.
 * Acepta `<a> <b>`, `<a>,<b>`, saltos de línea plegados y ids sin `<>`.
 */
export function parseMessageIdList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  const push = (v: string) => {
    const id = normalizeMessageId(v);
    if (id && !out.includes(id)) out.push(id);
  };
  const bracketed = raw.match(/<[^<>\s]+>/g);
  if (bracketed && bracketed.length > 0) {
    bracketed.forEach(push);
  } else {
    raw.split(/[\s,]+/).forEach((part) => {
      if (part.includes("@")) push(part);
    });
  }
  return out;
}

/** Variantes a buscar en BD: con y sin `<>`, en minúsculas y tal cual. */
export function messageIdLookupVariants(ids: string[]): string[] {
  const set = new Set<string>();
  for (const id of ids) {
    const norm = normalizeMessageId(id);
    if (!norm) continue;
    const inner = norm.slice(1, -1);
    set.add(norm);
    set.add(inner);
    set.add(id.trim());
  }
  return Array.from(set);
}

const SUBJECT_PREFIX_RE = /^\s*(?:re|fwd?|fw|rv|aw|wg|tr|enc|r)\s*(?:\[\d+\])?\s*:\s*/i;

/** Quita prefijos Re:/RE:/Fwd:/FW:/RV: (repetidos) y normaliza espacios y caja. */
export function normalizeSubject(subject: string | null | undefined): string {
  let s = (subject ?? "").replace(/\s+/g, " ").trim();
  let prev = "";
  while (s !== prev) {
    prev = s;
    s = s.replace(SUBJECT_PREFIX_RE, "").trim();
  }
  return s.toLowerCase();
}

/** true si el asunto lleva prefijo de respuesta o reenvío. */
export function hasReplyPrefix(subject: string | null | undefined): boolean {
  return SUBJECT_PREFIX_RE.test(subject ?? "");
}

/** Asunto de respuesta sin apilar prefijos: "Re: <base>". */
export function replySubject(subject: string | null | undefined): string {
  const s = (subject ?? "").trim();
  if (/^\s*re\s*:/i.test(s)) return s;
  return `Re: ${s || "(sin asunto)"}`;
}

/** Asunto de reenvío: "Fwd: <asunto>" sin duplicar. */
export function forwardSubject(subject: string | null | undefined): string {
  const s = (subject ?? "").trim();
  if (/^\s*(fwd?|fw)\s*:/i.test(s)) return s;
  return `Fwd: ${s || "(sin asunto)"}`;
}

/** Ventana del respaldo por asunto. */
export const SUBJECT_FALLBACK_DAYS = 30;

export interface ThreadCandidateMessage {
  thread_id: string;
  subject: string | null;
  from_address: string;
  to_addresses: string[] | null;
  cc_addresses: string[] | null;
  received_at: string;
}

/**
 * Elige el hilo más reciente cuyo asunto normalizado coincide y en el que
 * participa la contraparte (como remitente o destinatario). Puro.
 */
export function pickSubjectMatch(
  candidates: ThreadCandidateMessage[],
  opts: { subject: string; counterpart: string; excludeThreadId?: string },
): string | null {
  const want = normalizeSubject(opts.subject);
  if (!want) return null;
  const cp = opts.counterpart.trim().toLowerCase();
  const sorted = [...candidates].sort((a, b) =>
    b.received_at.localeCompare(a.received_at),
  );
  for (const m of sorted) {
    if (m.thread_id === opts.excludeThreadId) continue;
    if (normalizeSubject(m.subject) !== want) continue;
    const people = [m.from_address, ...(m.to_addresses ?? []), ...(m.cc_addresses ?? [])]
      .map((a) => a.trim().toLowerCase());
    if (people.includes(cp)) return m.thread_id;
  }
  return null;
}

/**
 * Destinatarios de "responder a todos": remitente del último mensaje + To + Cc,
 * sin nuestros buzones ni duplicados. Si el último es nuestro, se responde a sus To/Cc.
 */
export function replyAllRecipients(
  last: { from_address: string; to_addresses: string[] | null; cc_addresses: string[] | null; direction: string },
  isOwn: (addr: string) => boolean,
): { to: string[]; cc: string[] } {
  const norm = (a: string) => a.trim().toLowerCase();
  const seen = new Set<string>();
  const take = (list: string[]) => {
    const out: string[] = [];
    for (const raw of list) {
      const a = norm(raw);
      if (!a || isOwn(a) || seen.has(a)) continue;
      seen.add(a);
      out.push(a);
    }
    return out;
  };
  const primary =
    last.direction === "inbound"
      ? [last.from_address, ...(last.to_addresses ?? [])]
      : [...(last.to_addresses ?? [])];
  const to = take(primary);
  const cc = take(last.cc_addresses ?? []);
  if (to.length === 0 && cc.length > 0) {
    return { to: [cc[0]], cc: cc.slice(1) };
  }
  return { to, cc };
}
