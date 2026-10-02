/**
 * Company mailboxes allowed in Correo (no catch-all).
 * Shared by inbound verify, store, reply, and UI filter chips.
 */

export const COMPANY_MAILBOXES = [
  "hola@galladev.com",
  "ociel@galladev.com",
] as const;

export type CompanyMailbox = (typeof COMPANY_MAILBOXES)[number];

const DISPLAY_FROM: Record<CompanyMailbox, { address: CompanyMailbox; name: string; from: string }> = {
  "hola@galladev.com": {
    address: "hola@galladev.com",
    name: "GallaDev",
    from: "GallaDev <hola@galladev.com>",
  },
  "ociel@galladev.com": {
    address: "ociel@galladev.com",
    name: "Ociel",
    from: "Ociel <ociel@galladev.com>",
  },
};

/** Normalize "Name <addr@x>" or bare addr to lowercase email. */
export function extractEmailAddress(address: string): string {
  const match = /<([^>]+)>/.exec(address);
  return (match?.[1] ?? address).trim().toLowerCase();
}

const BASIC_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Correo externo usable como destinatario.
 * Rechaza vacío, basura, más de 320 caracteres y saltos de línea.
 */
export function isValidExternalEmail(value: string): boolean {
  if (!value || /[\r\n]/.test(value)) return false;
  const email = extractEmailAddress(value);
  return BASIC_EMAIL_RE.test(email) && email.length <= 320;
}

export function isCompanyMailbox(value: string): value is CompanyMailbox {
  return (COMPANY_MAILBOXES as readonly string[]).includes(value);
}

export function isAllowedRecipient(addresses: string[]): boolean {
  return addresses.some((a) => isCompanyMailbox(extractEmailAddress(a)));
}

/**
 * First allowlisted address in to/cc/bcc order.
 * Prefer to, then cc, then bcc. Within each list, COMPANY_MAILBOXES order.
 */
export function resolveMailbox(
  to: string[] = [],
  cc: string[] = [],
  bcc: string[] = [],
): CompanyMailbox | null {
  const pools = [to, cc, bcc].map((list) =>
    list.map(extractEmailAddress).filter(isCompanyMailbox),
  );
  for (const pool of pools) {
    for (const mailbox of COMPANY_MAILBOXES) {
      if (pool.includes(mailbox)) return mailbox;
    }
  }
  return null;
}

export function displayFrom(mailbox: CompanyMailbox): {
  address: CompanyMailbox;
  name: string;
  from: string;
} {
  return DISPLAY_FROM[mailbox];
}

/** Short chip label: hola / ociel */
export function mailboxChipLabel(mailbox: string): string {
  const local = mailbox.split("@")[0] ?? mailbox;
  return local;
}

export function defaultMailbox(): CompanyMailbox {
  return "hola@galladev.com";
}
