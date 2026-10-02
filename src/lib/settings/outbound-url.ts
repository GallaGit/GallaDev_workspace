/**
 * URLs a las que el servidor puede hacer fetch (n8n).
 * https, sin usuario/contraseña, sin literales de loopback, enlace local,
 * rangos privados ni nombres de metadatos de nube.
 *
 * `N8N_ALLOWED_HOSTS` (lista separada por comas) restringe aún más el host.
 * Si no está, cualquier host público https pasa: así un n8n ya configurado
 * sigue funcionando. El riesgo residual es un nombre que resuelva a una IP
 * privada; fijar la lista lo cierra.
 */

import { isIP } from "node:net";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "metadata.google.com",
  "instance-data",
  "instance-data.ec2.internal",
]);

const BLOCKED_SUFFIXES = [".local", ".localhost", ".internal", ".localdomain"];

export function allowedOutboundHosts(): Set<string> | null {
  const raw = process.env.N8N_ALLOWED_HOSTS?.trim();
  if (!raw) return null;
  const hosts = raw
    .split(",")
    .map((host) => host.trim().toLowerCase().replace(/\.+$/, ""))
    .filter(Boolean);
  return hosts.length > 0 ? new Set(hosts) : null;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

function inCidr(ip: number, base: string, bits: number): boolean {
  const network = ipv4ToInt(base);
  if (network === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ip & mask) === (network & mask);
}

function isNonPublicIpv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value === null) return true;
  const ranges: Array<[string, number]> = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ];
  return ranges.some(([base, bits]) => inCidr(value, base, bits));
}

function expandIpv6(ip: string): string | null {
  const lower = ip.toLowerCase();
  const halves = lower.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  if (halves.length === 1) {
    if (head.length !== 8) return null;
    if (head.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;
    return head.map((part) => part.padStart(4, "0")).join(":");
  }
  const tail = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;
  const parts = [...head, ...Array.from({ length: missing }, () => "0"), ...tail];
  if (parts.length !== 8) return null;
  if (parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  return parts.map((part) => part.padStart(4, "0")).join(":");
}

function isNonPublicIpv6(ip: string): boolean {
  if (ip.toLowerCase().startsWith("::ffff:")) {
    const mapped = ip.slice("::ffff:".length);
    return isIP(mapped) !== 4 || isNonPublicIpv4(mapped);
  }
  const full = expandIpv6(ip);
  if (!full) return true;
  const first = Number.parseInt(full.slice(0, 4), 16);
  if ((first & 0xffc0) === 0xfe80) return true;
  if ((first & 0xfe00) === 0xfc00) return true;
  if ((first & 0xff00) === 0xff00) return true;
  if (first >= 0x2000 && first <= 0x3fff) return false;
  return true;
}

function isNonPublicIp(host: string): boolean {
  const bare = host.toLowerCase();
  const kind = isIP(bare);
  if (kind === 4) return isNonPublicIpv4(bare);
  if (kind === 6) return isNonPublicIpv6(bare);
  return false;
}

function blockedHostname(host: string): boolean {
  const name = host.toLowerCase().replace(/\.+$/, "");
  if (!name || BLOCKED_HOSTS.has(name)) return true;
  if (BLOCKED_SUFFIXES.some((suffix) => name.endsWith(suffix))) return true;
  if (/^\d+$/.test(name) || /^0x[0-9a-f]+$/i.test(name)) return true;
  if (!name.includes(".") && isIP(name) === 0) return true;
  if (isIP(name) !== 0) return isNonPublicIp(name);
  return false;
}

/** null si la URL se puede usar. El mensaje no repite el host. */
export function outboundUrlError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Debe ser una URL https válida";
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return "Debe ser una URL https válida";
  }
  if (url.protocol !== "https:") return "La URL debe usar https";
  if (url.username || url.password) {
    return "La URL no puede incluir usuario o contraseña";
  }
  const host = url.hostname.toLowerCase().replace(/\.+$/, "");
  if (!host || blockedHostname(host)) return "Ese host no está permitido";
  const allow = allowedOutboundHosts();
  if (allow && !allow.has(host)) return "Ese host no está permitido";
  return null;
}

/** Mismo host ya guardado y permitido: solo entonces se envía la API key. */
export function shouldSendN8nApiKey(
  savedBaseUrl: string,
  effectiveBaseUrl: string,
): boolean {
  const saved = savedBaseUrl.trim();
  const next = effectiveBaseUrl.trim();
  if (!saved || !next) return false;
  if (outboundUrlError(saved) || outboundUrlError(next)) return false;
  try {
    return new URL(saved).hostname.toLowerCase() === new URL(next).hostname.toLowerCase();
  } catch {
    return false;
  }
}
