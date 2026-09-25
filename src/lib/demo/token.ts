import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { VISITOR_TTL_SECONDS } from "./config";

const VERSION = "v1";

export interface SignedVisitorToken {
  token: string;
  maxAge: number;
}

/**
 * Cookie opaca: `v1.<exp>.<nonce>.<hmac>`.
 * El servidor no guarda sesión; la firma y la caducidad bastan.
 */
export function signVisitorToken(
  secret: string,
  nowMs = Date.now(),
): SignedVisitorToken {
  const exp = Math.floor(nowMs / 1000) + VISITOR_TTL_SECONDS;
  const nonce = randomBytes(12).toString("base64url");
  const payload = `${VERSION}.${exp}.${nonce}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return { token: `${payload}.${sig}`, maxAge: VISITOR_TTL_SECONDS };
}

export function verifyVisitorToken(
  token: string | undefined | null,
  secret: string,
  nowMs = Date.now(),
): boolean {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 4) return false;
  const [version, expRaw, nonce, sig] = parts;
  if (version !== VERSION || !expRaw || !nonce || !sig) return false;
  if (!/^\d+$/.test(expRaw)) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 <= nowMs) return false;
  if (nonce.length < 8) return false;
  const payload = `${version}.${expRaw}.${nonce}`;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
