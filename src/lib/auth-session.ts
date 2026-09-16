/**
 * Sesión mínima del workspace (un solo usuario: Ociel).
 *
 * - Login con contraseña compartida (AUTH_PASSWORD, solo servidor).
 * - Cookie firmada con AUTH_SECRET (HMAC-SHA256, WebCrypto: funciona en
 *   Edge/middleware y en Node/routes con la misma implementación).
 * - Sin AUTH_SECRET → auth desactivada (dev). Sin AUTH_PASSWORD pero con
 *   AUTH_SECRET → login responde 503 (evita bloqueos silenciosos).
 */

export const SESSION_COOKIE = "lead_crm_session";
export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

const enc = new TextEncoder();

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

/** Emite token `exp_hex.payload_b64.sig_b64`. Null si no hay AUTH_SECRET. */
export async function issueSession(now = Date.now()): Promise<string | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  const exp = now + SESSION_TTL_MS;
  const payload = b64urlEncode(enc.encode(JSON.stringify({ exp })));
  const sig = b64urlEncode(await hmac(secret, payload));
  return `${payload}.${sig}`;
}

/** Verifica firma y caducidad. */
export async function verifySession(
  token: string,
  now = Date.now(),
): Promise<boolean> {
  const secret = process.env.AUTH_SECRET;
  if (!secret || !token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  let sig: Uint8Array;
  let payloadBytes: Uint8Array;
  try {
    sig = b64urlDecode(token.slice(dot + 1));
    payloadBytes = b64urlDecode(payload);
  } catch {
    return false;
  }
  const expected = await hmac(secret, payload);
  if (!constantTimeEqual(sig, expected)) return false;
  try {
    const { exp } = JSON.parse(
      new TextDecoder().decode(payloadBytes),
    ) as { exp: unknown };
    return typeof exp === "number" && exp > now;
  } catch {
    return false;
  }
}
