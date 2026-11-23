/** Destinatario preferido de un lead: gerente → comercial → general. */
export function pickLeadEmail(lead: {
  email?: string | null;
  emailCommercial?: string | null;
  emailManager?: string | null;
}): string | null {
  return (
    lead.emailManager?.trim() ||
    lead.emailCommercial?.trim() ||
    lead.email?.trim() ||
    null
  );
}
