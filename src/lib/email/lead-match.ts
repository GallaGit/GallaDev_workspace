import {
  extractEmailAddress,
  isCompanyMailbox,
  isValidExternalEmail,
} from "./mailboxes";

/**
 * Coincidencia de hilos de correo con leads por dirección de email.
 * Lógica pura: la usan el webhook inbound, compose/reply y el backfill.
 */

export type LeadEmailRow = {
  id: string;
  email?: string | null;
  email_commercial?: string | null;
  email_manager?: string | null;
};

export type LeadMatch =
  | { status: "matched"; leadId: string }
  | { status: "ambiguous"; leadIds: string[] }
  | { status: "none" };

/** Minúsculas y sin espacios; acepta «Nombre <a@b.com>». Vacío si no hay dirección. */
export function normalizeEmail(value: string | null | undefined): string {
  if (!value) return "";
  return extractEmailAddress(value).replace(/\s+/g, "").toLowerCase();
}

/**
 * Direcciones externas únicas (normalizadas) de varias listas: descarta
 * nuestros buzones y lo que no parezca un email.
 */
export function externalAddresses(
  ...lists: ReadonlyArray<ReadonlyArray<string | null | undefined> | null | undefined>
): string[] {
  const seen = new Set<string>();
  for (const list of lists) {
    for (const raw of list ?? []) {
      const address = normalizeEmail(raw);
      if (!address || isCompanyMailbox(address)) continue;
      if (!isValidExternalEmail(address)) continue;
      seen.add(address);
    }
  }
  return Array.from(seen);
}

/** Emails normalizados de un lead (principal, comercial y responsable). */
export function leadEmailSet(lead: LeadEmailRow): Set<string> {
  const set = new Set<string>();
  for (const value of [lead.email, lead.email_commercial, lead.email_manager]) {
    const normalized = normalizeEmail(value);
    if (normalized) set.add(normalized);
  }
  return set;
}

/**
 * Un único lead cuyo email coincide con alguna dirección → `matched`.
 * Dos o más leads distintos → `ambiguous` (se deja para vincular a mano).
 * Un mismo lead con varios emails coincidentes cuenta una sola vez.
 */
export function resolveLeadMatch(
  addresses: readonly string[],
  leads: readonly LeadEmailRow[],
): LeadMatch {
  const wanted = new Set(addresses.map(normalizeEmail).filter(Boolean));
  if (wanted.size === 0) return { status: "none" };

  const ids = new Set<string>();
  for (const lead of leads) {
    for (const email of leadEmailSet(lead)) {
      if (wanted.has(email)) {
        ids.add(lead.id);
        break;
      }
    }
  }
  if (ids.size === 0) return { status: "none" };
  if (ids.size === 1) return { status: "matched", leadId: Array.from(ids)[0] };
  return { status: "ambiguous", leadIds: Array.from(ids) };
}
