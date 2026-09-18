import { substituteFechaPlaceholder } from "./format-fecha";
import type { IntakePublicStatus, IntakeSettings } from "./types";

/**
 * Estado efectivo de captación.
 * - isOpen → abierto
 * - pausado pero reopensAt ya pasó → auto-abierto (sin mutar la fila aquí)
 * - pausado con reopensAt futuro o null → cerrado (+ mensaje con `{fecha}`)
 */
export function resolveIntakeStatus(
  settings: Pick<IntakeSettings, "isOpen" | "message" | "reopensAt">,
  now: Date = new Date(),
  timeZone = "Europe/Berlin",
): IntakePublicStatus {
  if (settings.isOpen) {
    return { open: true };
  }

  const reopensAt = settings.reopensAt;
  if (reopensAt) {
    const reopenMs = new Date(reopensAt).getTime();
    if (!Number.isNaN(reopenMs) && reopenMs <= now.getTime()) {
      return { open: true };
    }
  }

  return {
    open: false,
    message: substituteFechaPlaceholder(
      settings.message ?? "",
      reopensAt,
      timeZone,
    ),
    reopensAt: reopensAt ?? null,
  };
}

/** True si la fila está marcada cerrada pero el countdown ya expiró. */
export function shouldAutoOpen(
  settings: Pick<IntakeSettings, "isOpen" | "reopensAt">,
  now: Date = new Date(),
): boolean {
  if (settings.isOpen) return false;
  if (!settings.reopensAt) return false;
  const reopenMs = new Date(settings.reopensAt).getTime();
  if (Number.isNaN(reopenMs)) return false;
  return reopenMs <= now.getTime();
}
