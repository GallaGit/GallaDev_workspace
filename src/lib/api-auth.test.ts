import { afterEach, describe, expect, it, vi } from "vitest";
import { getCookieValue, requireApiSession } from "./api-auth";
import { issueSession } from "./auth-session";

const SECRET = "test-api-auth-secret-1234567890";

function requestWithCookie(cookie: string | null): Request {
  const headers = new Headers();
  if (cookie !== null) headers.set("cookie", cookie);
  return new Request("http://localhost/api/leads", { headers });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getCookieValue", () => {
  it("extrae la cookie de sesión entre otras", () => {
    expect(
      getCookieValue(
        "other=1; lead_crm_session=abc.def; theme=dark",
        "lead_crm_session",
      ),
    ).toBe("abc.def");
  });

  it("null sin cabecera o sin la cookie", () => {
    expect(getCookieValue(null, "lead_crm_session")).toBeNull();
    expect(getCookieValue("other=1", "lead_crm_session")).toBeNull();
    expect(getCookieValue("", "lead_crm_session")).toBeNull();
  });
});

describe("requireApiSession", () => {
  it("permite todo con AUTH_DISABLED=true (dev local)", async () => {
    vi.stubEnv("AUTH_DISABLED", "true");
    vi.stubEnv("AUTH_SECRET", "");
    expect(await requireApiSession(requestWithCookie(null))).toBeNull();
  });

  it("401 sin cookie cuando el auth está activo", async () => {
    vi.stubEnv("AUTH_DISABLED", "false");
    vi.stubEnv("AUTH_SECRET", SECRET);
    const denied = await requireApiSession(requestWithCookie(null));
    expect(denied).not.toBeNull();
    expect(denied!.status).toBe(401);
    expect(await denied!.json()).toMatchObject({ ok: false });
  });

  it("401 con token inválido", async () => {
    vi.stubEnv("AUTH_DISABLED", "false");
    vi.stubEnv("AUTH_SECRET", SECRET);
    const denied = await requireApiSession(
      requestWithCookie("lead_crm_session=forged.payload"),
    );
    expect(denied).not.toBeNull();
    expect(denied!.status).toBe(401);
  });

  it("permite con token válido", async () => {
    vi.stubEnv("AUTH_DISABLED", "false");
    vi.stubEnv("AUTH_SECRET", SECRET);
    const token = await issueSession();
    expect(token).not.toBeNull();
    expect(
      await requireApiSession(
        requestWithCookie(`lead_crm_session=${token}`),
      ),
    ).toBeNull();
  });
});
