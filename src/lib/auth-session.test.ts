import { afterEach, describe, expect, it, vi } from "vitest";
import {
  issueSession,
  passwordOk,
  verifySession,
} from "./auth-session";

const SECRET = "test-auth-secret-1234567890";
const PASSWORD = "contraseña-de-prueba";

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

  it("rechaza token manipulado, caducado o con otro secreto", async () => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    const token = (await issueSession()) ?? "";
    // Manipulado
    expect(await verifySession(`${token.slice(0, -2)}xx`)).toBe(false);
    expect(await verifySession("basura")).toBe(false);
    expect(await verifySession("")).toBe(false);
    // Caducado (viaja al futuro en la verificación)
    const [payload] = token.split(".");
    void payload;
    expect(await verifySession(token, Date.now() + 31 * 24 * 3600 * 1000)).toBe(
      false,
    );
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
