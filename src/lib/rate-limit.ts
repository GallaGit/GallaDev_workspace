/**
 * Rate-limit en memoria + lectura de JSON con tope (M1 — GEM_ROADMAP 1.4).
 *
 * Best-effort por instancia: en serverless cada instancia lleva su propio
 * contador, así que no es un límite global distribuido. Es suficiente para
 * frenar abuso básico (fuerza bruta al login, spam a la ingesta pública)
 * sin añadir infraestructura. La expiración por ventana evita crecimiento
 * del mapa: las IPs sin hits recientes se purgan al consultar.
 */

/** IP del cliente según `x-forwarded-for` (proxy/CDN) o "unknown". */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

export interface RateLimitOptions {
  /** Ventana deslizante en ms (default 60s). */
  windowMs?: number;
  /** Máximo de peticiones por ventana e IP (default 30). */
  max?: number;
}

const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_MAX = 30;

/** Contadores por espacio de nombres → IP → timestamps. */
const stores = new Map<string, Map<string, number[]>>();

/**
 * Registra un hit y dice si la IP supera el límite.
 * `now` inyectable para tests. Purga entradas fuera de ventana.
 */
export function isRateLimited(
  namespace: string,
  ip: string,
  options: RateLimitOptions = {},
  now = Date.now(),
): boolean {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const max = options.max ?? DEFAULT_MAX;
  let store = stores.get(namespace);
  if (!store) {
    store = new Map<string, number[]>();
    stores.set(namespace, store);
  }
  const hits = (store.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    store.set(ip, hits);
    return true;
  }
  hits.push(now);
  store.set(ip, hits);
  return false;
}

/** Solo para tests: vacía todos los contadores. */
export function resetRateLimits(): void {
  stores.clear();
}

export type CappedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 };

/**
 * Lee el body como texto, rechaza si supera `maxBytes` (413) y parsea JSON.
 * Evita que `request.json()` acepte payloads gigantes sin control.
 */
export async function readCappedJson(
  request: Request,
  maxBytes: number,
): Promise<CappedJsonResult> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, status: 400 };
  }
  if (text.length > maxBytes) return { ok: false, status: 413 };
  try {
    return { ok: true, value: JSON.parse(text || "{}") as unknown };
  } catch {
    return { ok: false, status: 400 };
  }
}
