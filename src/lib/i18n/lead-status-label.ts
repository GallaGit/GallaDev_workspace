import type { LeadStatus } from "@/lib/domain/lead";

/** Message keys under `leadStatus` for each DB enum value. */
export const LEAD_STATUS_MESSAGE_KEYS = {
  Nuevo: "Nuevo",
  "Pendiente revisar": "Pendiente revisar",
  Validado: "Validado",
  "Email preparado": "Email preparado",
  "Email enviado": "Email enviado",
  Respondió: "Respondió",
  Reunión: "Reunión",
  Cliente: "Cliente",
  Descartado: "Descartado",
} as const satisfies Record<LeadStatus, string>;

export type LeadStatusTranslator = {
  (key: LeadStatus): string;
};

/**
 * Map a DB/API lead_status enum value to a localized UI label.
 * Never change the stored enum — only the display string.
 */
export function leadStatusLabel(
  t: LeadStatusTranslator,
  status: string,
): string {
  if (status in LEAD_STATUS_MESSAGE_KEYS) {
    return t(status as LeadStatus);
  }
  return status;
}
