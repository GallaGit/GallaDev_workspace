import { afterEach, describe, expect, it, vi } from "vitest";
import {
  issueSession,
  passwordOk,
  readSessionExp,
  sessionNeedsRefresh,
  sessionTtlMs,
  verifySession,
  verifySessionDetailed,
} from "./auth-session";

const SECRET = "test-auth-secret-1234567890";
const PASSWORD = "contraseña-de-prueba";
const DAY_MS = 24 * 3600 * 1000;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("auth-session", () => {
  it("emite y verifica un token válido", async () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    const token = await issueSession();
    expect(token).toContain(".");
    expect(await verifySession(token ?? "")).toBe(true);
  });

  it("TTL por defecto es 1 día (caduca ~2 días adelante)", async () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    vi.stubEnv("SESSION_TTL_DAYS", "");
    expect(sessionTtlMs()).toBe(1 * DAY_MS);
    const now = Date.now();
    const token = (await issueSession(now)) ?? "";
    expect(await verifySession(token, now + 12 * 3600 * 1000)).toBe(true);
    expect(await verifySession(token, now + 2 * DAY_MS)).toBe(false);
  });

  it("SESSION_TTL_DAYS=7 produce token más longevo que el default", async () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    vi.stubEnv("SESSION_TTL_DAYS", "1");
    const now = Date.now();
    const shortToken = (await issueSession(now)) ?? "";
    const shortExp = await readSessionExp(shortToken);

    vi.stubEnv("SESSION_TTL_DAYS", "7");
    const longToken = (await issueSession(now)) ?? "";
    const longExp = await readSessionExp(longToken);

    expect(shortExp).not.toBeNull();
    expect(longExp).not.toBeNull();
    expect(longExp! - shortExp!).toBe(6 * DAY_MS);
    // A ~3 días el de 1 día ya caducó; el de 7 sigue válido.
    expect(await verifySession(shortToken, now + 3 * DAY_MS)).toBe(false);
    expect(await verifySession(longToken, now + 3 * DAY_MS)).toBe(true);
  });

  it("SESSION_TTL_DAYS inválido cae a 1 día", () => {
    vi.stubEnv("SESSION_TTL_DAYS", "abc");
    expect(sessionTtlMs()).toBe(1 * DAY_MS);
    vi.stubEnv("SESSION_TTL_DAYS", "0");
    expect(sessionTtlMs()).toBe(1 * DAY_MS);
    vi.stubEnv("SESSION_TTL_DAYS", "-5");
    expect(sessionTtlMs()).toBe(1 * DAY_MS);
    vi.stubEnv("SESSION_TTL_DAYS", "999");
    expect(sessionTtlMs()).toBe(90 * DAY_MS);
  });

  it("sessionNeedsRefresh usa umbral TTL/2", () => {
    vi.stubEnv("SESSION_TTL_DAYS", "2");
    const ttl = sessionTtlMs();
    const now = 1_000_000;
    const exp = now + ttl;
    expect(sessionNeedsRefresh(exp, now)).toBe(false);
    expect(sessionNeedsRefresh(exp, now + ttl / 2 + 1)).toBe(true);
    expect(sessionNeedsRefresh(exp, now + ttl / 2 - 1)).toBe(false);
  });

  it("verifySessionDetailed y readSessionExp", async () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    vi.stubEnv("SESSION_TTL_DAYS", "1");
    const now = Date.now();
    const token = (await issueSession(now)) ?? "";
    const detailed = await verifySessionDetailed(token, now);
    expect(detailed.ok).toBe(true);
    if (detailed.ok) {
      expect(detailed.exp).toBe(now + DAY_MS);
    }
    expect(await readSessionExp(token)).toBe(now + DAY_MS);
    // Caducado: detailed falla, pero readSessionExp sigue leyendo exp.
    expect(await verifySessionDetailed(token, now + 2 * DAY_MS)).toEqual({
      ok: false,
    });
    expect(await readSessionExp(token)).toBe(now + DAY_MS);
  });

  it("rechaza token manipulado, caducado o con otro secreto", async () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    const token = (await issueSession()) ?? "";
    // Manipulado
    expect(await verifySession(`${token.slice(0, -2)}xx`)).toBe(false);
    expect(await verifySession("basura")).toBe(false);
    expect(await verifySession("")).toBe(false);
    // Caducado (viaja al futuro en la verificación; default TTL = 1 día)
    expect(await verifySession(token, Date.now() + 2 * DAY_MS)).toBe(false);
    // Otro secreto
    vi.stubEnv("AUTH_SECRET", "otro-secreto-distinto-09876");
    expect(await verifySession(token)).toBe(false);
  });

  it("sin AUTH_SECRET no emite ni verifica", async () => {
    vi.stubEnv("AUTH_SECRET", "");
    expect(await issueSession()).toBeNull();
    expect(await verifySession("a.b")).toBe(false);
  });

  it("passwordOk solo acepta la contraseña configurada", async () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    vi.stubEnv("AUTH_PASSWORD", PASSWORD);
    expect(await passwordOk(PASSWORD)).toBe(true);
    expect(await passwordOk("otra")).toBe(false);
    expect(await passwordOk("")).toBe(false);
  });

  it("passwordOk es falso si falta configuración", async () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    vi.stubEnv("AUTH_PASSWORD", "");
    expect(await passwordOk(PASSWORD)).toBe(false);
  });
});
