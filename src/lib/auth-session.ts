/**
 * Sesión mínima del workspace (un solo usuario: Ociel).
 *
 * - Login con contraseña compartida (AUTH_PASSWORD, solo servidor).
 * - Cookie firmada con AUTH_SECRET (HMAC-SHA256, WebCrypto: funciona en
 *   Edge/middleware y en Node/routes con la misma implementación).
 * - Sin AUTH_SECRET → auth desactivada (dev). Sin AUTH_PASSWORD pero con
 *   AUTH_SECRET → login responde 503 (evita bloqueos silenciosos).
 * - TTL configurable con SESSION_TTL_DAYS (default 1, rango 1–90).
 */

import { getSessionEpoch } from "@/lib/session-epoch-edge";

export const SESSION_COOKIE = "lead_crm_session";

const DAY_MS = 24 * 3600 * 1000;
const DEFAULT_TTL_DAYS = 1;
const MIN_TTL_DAYS = 1;
const MAX_TTL_DAYS = 90;

const enc = new TextEncoder();

/**
 * Duración de sesión en ms según SESSION_TTL_DAYS.
 * Missing / NaN / inválido → 1 día. Clamp [1, 90].
 */
export function sessionTtlMs(): number {
  const raw = process.env.SESSION_TTL_DAYS;
  const parsed = raw === undefined || raw === "" ? NaN : Number.parseInt(raw, 10);
  const days =
    Number.isFinite(parsed) && parsed >= MIN_TTL_DAYS
      ? Math.min(Math.floor(parsed), MAX_TTL_DAYS)
      : DEFAULT_TTL_DAYS;
  return days * DAY_MS;
}

/** Opciones de cookie de sesión (login + sliding refresh). */
export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/" as const,
    maxAge: maxAgeSeconds,
  };
}

/** True si queda menos de la mitad del TTL → conviene renovar. */
export function sessionNeedsRefresh(exp: number, now = Date.now()): boolean {
  return exp - now < sessionTtlMs() / 2;
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return new Uint8Array(sig);
}

/** Comparación en tiempo constante sobre bytes. */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function authPasswordConfigured(): boolean {
  return Boolean(process.env.AUTH_PASSWORD);
}

export function authSecretConfigured(): boolean {
  return Boolean(process.env.AUTH_SECRET);
}

/** Contraseña del login. Falso si falta a cualquier lado (nunca dejar pasar). */
export async function passwordOk(provided: string): Promise<boolean> {
  const expected = process.env.AUTH_PASSWORD ?? "";
  if (!provided || !expected) return false;
  // HMAC antes de comparar para no filtrar por longitud/timing.
  const secret = process.env.AUTH_SECRET || "auth-session-fallback";
  const [ha, hb] = await Promise.all([
    hmac(secret, `pw:${provided}`),
    hmac(secret, `pw:${expected}`),
  ]);
  return constantTimeEqual(ha, hb);
}

/**
 * Emite token `payload_b64.sig_b64`.
 * Null si no hay AUTH_SECRET o si el epoch es desconocido (fail-closed:
 * no se emiten tokens que luego no se puedan validar).
 */
export async function issueSession(now = Date.now()): Promise<string | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  const sv = await getSessionEpoch();
  if (sv === null) return null;
  const exp = now + sessionTtlMs();
  const payload = b64urlEncode(enc.encode(JSON.stringify({ exp, sv })));
  const sig = b64urlEncode(await hmac(secret, payload));
  return `${payload}.${sig}`;
}

export type SessionVerifyResult =
  | { ok: true; exp: number; sv: number }
  | { ok: false };

/**
 * Verifica firma y caducidad; devuelve `exp` si es válida.
 * Útil para sliding refresh en middleware.
 */
export async function verifySessionDetailed(
  token: string,
  now = Date.now(),
): Promise<SessionVerifyResult> {
  const secret = process.env.AUTH_SECRET;
  if (!secret || !token) return { ok: false };
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return { ok: false };
  const payload = token.slice(0, dot);
  let sig: Uint8Array;
  let payloadBytes: Uint8Array;
  try {
    sig = b64urlDecode(token.slice(dot + 1));
    payloadBytes = b64urlDecode(payload);
  } catch {
    return { ok: false };
  }
  const expected = await hmac(secret, payload);
  if (!constantTimeEqual(sig, expected)) return { ok: false };
  try {
    const { exp, sv } = JSON.parse(
      new TextDecoder().decode(payloadBytes),
    ) as { exp: unknown; sv: unknown };
    // Epoch desconocido → rechazar (fail-closed, ver session-epoch-edge).
    const current = await getSessionEpoch();
    if (
      typeof exp !== "number" ||
      !(exp > now) ||
      typeof sv !== "number" ||
      !Number.isSafeInteger(sv) ||
      current === null ||
      sv !== current
    ) {
      return { ok: false };
    }
    return { ok: true, exp, sv };
  } catch {
    return { ok: false };
  }
}

/**
 * Lee `exp` de un token con firma válida (sin exigir no caducado).
 * Null si firma inválida o payload ilegible.
 */
export async function readSessionExp(token: string): Promise<number | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret || !token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  let sig: Uint8Array;
  let payloadBytes: Uint8Array;
  try {
    sig = b64urlDecode(token.slice(dot + 1));
    payloadBytes = b64urlDecode(payload);
  } catch {
    return null;
  }
  const expected = await hmac(secret, payload);
  if (!constantTimeEqual(sig, expected)) return null;
  try {
    const { exp } = JSON.parse(
      new TextDecoder().decode(payloadBytes),
    ) as { exp: unknown };
    return typeof exp === "number" ? exp : null;
  } catch {
    return null;
  }
}

/** Verifica firma y caducidad (compatibilidad). */
export async function verifySession(
  token: string,
  now = Date.now(),
): Promise<boolean> {
  const result = await verifySessionDetailed(token, now);
  return result.ok;
}
