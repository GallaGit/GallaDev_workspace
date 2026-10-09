import type { ThreadPatch, ThreadStatePatch } from "./email-payload";

/**
 * Estado de bandeja de un hilo (Recibidos / Archivados / Papelera) y
 * leído/no leído. Lógica pura: la usan las rutas PATCH y la UI.
 *
 * - Recibidos: archived_at IS NULL y trashed_at IS NULL.
 * - Archivados: archived_at con fecha y trashed_at IS NULL.
 * - Papelera: trashed_at con fecha (se podrá purgar a los 30 días).
 */

export const THREAD_VIEWS = ["inbox", "archived", "trash"] as const;
export type ThreadView = (typeof THREAD_VIEWS)[number];

/** Días en Papelera antes de que una purga futura pueda borrar el hilo. */
export const TRASH_RETENTION_DAYS = 30;

export function parseThreadView(raw: string | null | undefined): ThreadView {
  const value = (raw ?? "").trim().toLowerCase();
  return (THREAD_VIEWS as readonly string[]).includes(value)
    ? (value as ThreadView)
    : "inbox";
}

export type ThreadStateRow = {
  is_read: boolean;
  archived_at?: string | null;
  trashed_at?: string | null;
};

export function threadViewOf(thread: ThreadStateRow): ThreadView {
  if (thread.trashed_at) return "trash";
  if (thread.archived_at) return "archived";
  return "inbox";
}

export type ThreadDbPatch = {
  is_read?: boolean;
  lead_id?: string | null;
  archived_at?: string | null;
  trashed_at?: string | null;
};

/**
 * Traduce el PATCH de la API a columnas.
 * - `archived: true` archiva y, si no se indica `trashed`, saca de Papelera.
 * - `archived: false` vuelve a Recibidos y, si no se indica `trashed`,
 *   también sale de Papelera.
 * - `trashed: true|false` manda sobre la Papelera; al restaurar, el hilo
 *   vuelve donde estaba (Recibidos o Archivados).
 */
export function threadDbPatch(
  patch: ThreadPatch | ThreadStatePatch,
  now: Date = new Date(),
): ThreadDbPatch {
  const stamp = now.toISOString();
  const db: ThreadDbPatch = {};
  if (patch.is_read !== undefined) db.is_read = patch.is_read;
  if ("lead_id" in patch && patch.lead_id !== undefined) {
    db.lead_id = patch.lead_id;
  }
  if (patch.archived !== undefined) {
    db.archived_at = patch.archived ? stamp : null;
    if (patch.trashed === undefined) db.trashed_at = null;
  }
  if (patch.trashed !== undefined) {
    db.trashed_at = patch.trashed ? stamp : null;
  }
  return db;
}

/** Aplica el PATCH en memoria (UI optimista), con la misma regla que la BD. */
export function applyThreadPatch<T extends ThreadStateRow>(
  thread: T,
  patch: ThreadStatePatch,
  now: Date = new Date(),
): T {
  const db = threadDbPatch(patch, now);
  return { ...thread, ...db };
}

export type UnreadCounts = Record<ThreadView, number>;

export const EMPTY_UNREAD_COUNTS: UnreadCounts = {
  inbox: 0,
  archived: 0,
  trash: 0,
};

/** Texto del contador: vacío si 0, «99+» por encima de 99. */
export function formatUnreadBadge(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "";
  return count > 99 ? "99+" : String(Math.floor(count));
}

/** Evento de ventana para refrescar el contador de la barra lateral. */
export const UNREAD_CHANGED_EVENT = "correo:unread-changed";

/**
 * Fecha corta tipo Gmail: hora si es hoy, «Ayer», día de la semana si es
 * de los últimos 7 días, día y mes este año, fecha corta si es de otro año.
 */
export function formatThreadDate(
  iso: string,
  locale: string,
  labels: { yesterday: string },
  now: Date = new Date(),
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(date)) / 86_400_000);

  if (diffDays <= 0) {
    return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return labels.yesterday;
  if (diffDays < 7) {
    return date.toLocaleDateString(locale, { weekday: "short" });
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
  }
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

/** Toast tras una acción de bandeja; null si no hace falta (leído/no leído). */
export function stateToastKey(
  patch: ThreadStatePatch,
): "archivedToast" | "trashedToast" | "restoredToast" | "inboxToast" | null {
  if (patch.trashed === true) return "trashedToast";
  if (patch.trashed === false) return "restoredToast";
  if (patch.archived === true) return "archivedToast";
  if (patch.archived === false) return "inboxToast";
  return null;
}
