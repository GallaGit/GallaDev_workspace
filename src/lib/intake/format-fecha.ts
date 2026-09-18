/**
 * Formatea reopensAt para el placeholder `{fecha}` del mensaje de pausa.
 * Zona Europe/Berlin, locale es-ES (producto GallaDev).
 */
export function formatReopensAtForDisplay(
  reopensAt: string | null | undefined,
  timeZone = "Europe/Berlin",
): string {
  if (!reopensAt) return "";
  const d = new Date(reopensAt);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-ES", {
    timeZone,
    dateStyle: "long",
    timeStyle: "short",
  }).format(d);
}

/** Sustituye `{fecha}` (case-insensitive) en el mensaje. */
export function substituteFechaPlaceholder(
  message: string,
  reopensAt: string | null | undefined,
  timeZone = "Europe/Berlin",
): string {
  const formatted = formatReopensAtForDisplay(reopensAt, timeZone);
  return message.replace(/\{fecha\}/gi, formatted);
}
