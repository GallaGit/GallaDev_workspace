/** Filtros de vista de bandeja compartidos por listado y recuento. */

import type { ThreadView } from "./thread-state";

export const THREAD_LIST_COLUMNS =
  "id, subject, from_address, from_name, mailbox_address, last_message_at, is_read, message_count, lead_id, created_at, archived_at, trashed_at, last_snippet, has_attachments";

/** Select de lista: Enviados exige un inner join a mensajes outbound. */
export function threadListSelect(view: ThreadView, scope: "view" | "all"): string {
  if (scope !== "all" && view === "sent") {
    return `${THREAD_LIST_COLUMNS}, email_messages!inner(id)`;
  }
  return THREAD_LIST_COLUMNS;
}

/** Select de recuento (HEAD). Enviados usa el mismo inner join. */
export function threadCountSelect(view: ThreadView): string {
  return view === "sent" ? "id, email_messages!inner(id)" : "id";
}

type FilterQuery<Q> = {
  is: (column: string, value: null) => Q;
  not: (column: string, operator: string, value: null) => Q;
  eq: (column: string, value: string) => Q;
};

/**
 * Aplica el filtro de carpeta. Enviados: hay outbound y no está en Papelera
 * (los archivados siguen saliendo). El caller debe usar el select con
 * `email_messages!inner` cuando view es sent.
 */
export function applyThreadViewFilter<Q extends FilterQuery<Q>>(
  query: Q,
  view: ThreadView,
): Q {
  if (view === "sent") {
    return query.eq("email_messages.direction", "outbound").is("trashed_at", null);
  }
  if (view === "trash") {
    return query.not("trashed_at", "is", null);
  }
  query = query.is("trashed_at", null);
  return view === "archived"
    ? query.not("archived_at", "is", null)
    : query.is("archived_at", null);
}

/** Quita el embed de mensajes para no devolverlo al cliente. */
export function stripMessageEmbed(
  rows: unknown[] | null | undefined,
): Record<string, unknown>[] {
  return (rows ?? []).map((row) => {
    if (!row || typeof row !== "object") return {};
    const copy = { ...(row as Record<string, unknown>) };
    delete copy.email_messages;
    return copy;
  });
}
