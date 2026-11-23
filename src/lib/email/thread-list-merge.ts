type Dated = { id: string; last_message_at: string };

function time(value: string): number {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Mezcla la primera página recién pedida con la lista que ya está en pantalla
 * (refresco automático). Los hilos nuevos aparecen arriba y los que salieron de
 * la vista desaparecen; las páginas ya cargadas más abajo (Cargar más) se
 * conservan. Si la página no está llena, ya es la lista completa.
 */
export function mergeThreadPage<T extends Dated>(
  previous: readonly T[],
  fresh: readonly T[],
  pageSize: number,
): T[] {
  if (fresh.length < pageSize) return [...fresh];
  const oldest = time(fresh[fresh.length - 1].last_message_at);
  const seen = new Set(fresh.map((thread) => thread.id));
  const tail = previous.filter(
    (thread) => !seen.has(thread.id) && time(thread.last_message_at) <= oldest,
  );
  return [...fresh, ...tail];
}
