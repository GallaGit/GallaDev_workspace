/** Firmas por buzón: { "hola@galladev.com": "texto", ... }. null si no se pudo leer. */
export async function fetchMailboxSignatures(): Promise<Record<string, string> | null> {
  try {
    const res = await fetch("/api/email/signatures");
    if (!res.ok) return null;
    const data = (await res.json()) as { signatures?: unknown };
    const raw = data.signatures;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const out: Record<string, string> = {};
    for (const [mailbox, value] of Object.entries(raw)) {
      if (typeof value === "string") out[mailbox] = value;
    }
    return out;
  } catch {
    return null;
  }
}
