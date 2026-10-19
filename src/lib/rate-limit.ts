/**
 * Rate-limit + lectura de JSON con tope.
 *
 * La IP es la que marca la plataforma: `x-vercel-forwarded-for` (Vercel la
 * reescribe; no vale el primer tramo que el cliente ponga en
 * `x-forwarded-for`). Sin esa cabecera se usa el último salto de
 * `x-forwarded-for`, luego `x-real-ip` o `request.ip`.
 *
 * El contador en memoria es por instancia. Con Upstash configurado el cupo es
 * compartido entre instancias: `@upstash/ratelimit` con ventana deslizante
 * (`Ratelimit.slidingWindow`) sobre `@upstash/redis`, claves con prefijo
 * `gdw:rl:<namespace>`. Credenciales: `UPSTASH_REDIS_REST_URL` /
 * `UPSTASH_REDIS_REST_TOKEN` o, si faltan, `KV_REST_API_URL` /
 * `KV_REST_API_TOKEN` (los nombres que inyecta la integración Upstash del
 * Vercel Marketplace).
 *
 * Sin credenciales se usa la memoria, sin aviso. Si Redis falla o pasa el
 * timeout (1,5 s), se registra un `console.warn` y se vuelve al contador de
 * esta instancia (fail-open): la app no devuelve 500 y el tope deja de ser
 * global. El cupo de IA sigue siendo por id de usuario.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

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

interface UpstashConfig {
  url: string;
  token: string;
}

const UPSTASH_TIMEOUT_MS = 1500;
const IDENTIFIER_MAX_LENGTH = 180;

let redisClient: Redis | null = null;
let redisClientKey: string | null = null;
const limiters = new Map<string, Ratelimit>();

/** Solo para tests: vacía contadores, cliente Redis y limitadores. */
export function resetRateLimits(): void {
  stores.clear();
  redisClient = null;
  redisClientKey = null;
  limiters.clear();
}

function envValue(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

/** Lee el entorno en cada llamada: los tests lo sustituyen. */
function upstashConfig(): UpstashConfig | null {
  const url = envValue("UPSTASH_REDIS_REST_URL", "KV_REST_API_URL").replace(
    /\/$/,
    "",
  );
  const token = envValue("UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_TOKEN");
  if (!url.startsWith("https://") || !token) return null;
  return { url, token };
}

/** Cliente único por par url/token; se rehace si cambian. */
function redisFor(config: UpstashConfig): Redis {
  const key = `${config.url}|${config.token}`;
  if (!redisClient || redisClientKey !== key) {
    redisClient = new Redis({
      url: config.url,
      token: config.token,
      retry: { retries: 0 },
      enableTelemetry: false,
    });
    redisClientKey = key;
    limiters.clear();
  }
  return redisClient;
}

function limiterFor(
  config: UpstashConfig,
  namespace: string,
  windowMs: number,
  max: number,
): Ratelimit {
  const cacheKey = `${namespace}|${max}|${windowMs}`;
  const redis = redisFor(config);
  const cached = limiters.get(cacheKey);
  if (cached) return cached;
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, `${windowMs} ms`),
    prefix: `gdw:rl:${namespace}`,
    analytics: false,
    ephemeralCache: false,
    timeout: UPSTASH_TIMEOUT_MS,
  });
  limiters.set(cacheKey, limiter);
  return limiter;
}

function identifier(key: string): string {
  return key
    .replace(/[^A-Za-z0-9:._@-]/g, "_")
    .slice(0, IDENTIFIER_MAX_LENGTH);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Igual que `isRateLimited`, y en Redis si Upstash está configurado.
 * Cualquier fallo de Redis vuelve al contador de esta instancia.
 */
export async function consumeRateLimit(
  namespace: string,
  key: string,
  options: RateLimitOptions = {},
  now = Date.now(),
): Promise<boolean> {
  const config = upstashConfig();
  if (!config) return isRateLimited(namespace, key, options, now);
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const max = options.max ?? DEFAULT_MAX;
  try {
    const limiter = limiterFor(config, namespace, windowMs, max);
    const result = await limiter.limit(identifier(key));
    if (result.reason === "timeout") throw new Error("timeout de Upstash");
    return !result.success;
  } catch (error) {
    console.warn(
      "[rate-limit] Upstash no disponible, uso memoria:",
      errorMessage(error),
    );
    return isRateLimited(namespace, key, options, now);
  }
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
