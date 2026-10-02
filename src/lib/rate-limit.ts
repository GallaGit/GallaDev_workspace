/**
 * Rate-limit + lectura de JSON con tope.
 *
 * La IP es la que marca la plataforma: `x-vercel-forwarded-for` (Vercel la
 * reescribe; no vale el primer tramo que el cliente ponga en
 * `x-forwarded-for`). Sin esa cabecera se usa el último salto de
 * `x-forwarded-for`, luego `x-real-ip` o `request.ip`.
 *
 * El contador en memoria es por instancia. Con `UPSTASH_REDIS_REST_URL` y
 * `UPSTASH_REDIS_REST_TOKEN` el cupo es compartido (ventana fija en Redis).
 * Si faltan o Redis no responde, se vuelve a la memoria: la app no se cae,
 * y el tope deja de ser global. El cupo de IA sigue siendo por id de usuario.
 */

const UNKNOWN_IP = "unknown";

function hopList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** IP del cliente. "unknown" si la plataforma no la marca. */
export function clientIp(request: Request): string {
  const vercel = hopList(request.headers.get("x-vercel-forwarded-for"));
  if (vercel[0]) return vercel[0];
  const forwarded = hopList(request.headers.get("x-forwarded-for"));
  if (forwarded.length > 0) return forwarded[forwarded.length - 1] ?? UNKNOWN_IP;
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const platformIp = (request as { ip?: string | null }).ip;
  if (typeof platformIp === "string" && platformIp.trim()) return platformIp.trim();
  return UNKNOWN_IP;
}

/** Cupo diario de acuses de la ingesta web. No depende de la IP. */
export const INGEST_RECEIPT_NAMESPACE = "ingest:receipt";
export const INGEST_RECEIPT_KEY = "global";
export const INGEST_RECEIPT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const INGEST_RECEIPT_MAX = 200;

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

function upstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/$/, "") ?? "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? "";
  if (!url.startsWith("https://") || !token) return null;
  return { url, token };
}

function redisKey(namespace: string, key: string, bucket: number): string {
  const safe = `${namespace}:${key}`
    .replace(/[^A-Za-z0-9:._-]/g, "_")
    .slice(0, 180);
  return `gdw:rl:${safe}:${bucket}`;
}

async function upstashLimited(
  namespace: string,
  key: string,
  options: RateLimitOptions,
  now: number,
): Promise<boolean> {
  const config = upstashConfig();
  if (!config) return isRateLimited(namespace, key, options, now);
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const max = options.max ?? DEFAULT_MAX;
  const bucket = Math.floor(now / windowMs);
  const id = redisKey(namespace, key, bucket);
  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", id],
      ["PEXPIRE", id, String(windowMs)],
    ]),
    signal: AbortSignal.timeout(1500),
  });
  if (!response.ok) throw new Error("upstash");
  const data = (await response.json()) as { result?: unknown }[];
  const count = Number(data[0]?.result);
  if (!Number.isFinite(count)) throw new Error("upstash");
  return count > max;
}

/**
 * Igual que `isRateLimited`, y en Redis si Upstash está configurado.
 * Un fallo de Redis vuelve al contador de esta instancia.
 */
export async function consumeRateLimit(
  namespace: string,
  key: string,
  options: RateLimitOptions = {},
  now = Date.now(),
): Promise<boolean> {
  if (upstashConfig()) {
    try {
      return await upstashLimited(namespace, key, options, now);
    } catch {
      return isRateLimited(namespace, key, options, now);
    }
  }
  return isRateLimited(namespace, key, options, now);
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
