import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOGIN_GENERIC_ERROR,
  LOGIN_MAX_PER_ACCOUNT,
  LOGIN_MAX_PER_IP,
  LOGIN_RATE_ERROR,
} from "./login-limit";
import { resetRateLimits } from "@/lib/rate-limit";

const signInWithPassword = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { signInWithPassword },
  })),
}));

function loginRequest(email: string, password: string, ip: string) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-vercel-forwarded-for": ip,
    },
    body: JSON.stringify({ email, password }),
  });
}

beforeEach(() => {
  resetRateLimits();
  signInWithPassword.mockReset();
  signInWithPassword.mockResolvedValue({
    data: { user: null },
    error: { message: "Email not confirmed" },
  });
  vi.unstubAllEnvs();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe("POST /api/auth/login", () => {
  it("responde lo mismo si Auth dice que el correo no está confirmado", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(loginRequest("Ana@Example.com", "secret", "203.0.113.10"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: LOGIN_GENERIC_ERROR });
    expect(JSON.stringify(body)).not.toMatch(/confirmed/i);
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "secret",
    });
  });

  it("corta por cuenta antes de volver a llamar a Auth", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    for (let i = 0; i < LOGIN_MAX_PER_ACCOUNT; i += 1) {
      const res = await POST(
        loginRequest("ana@example.com", "bad", `203.0.113.${i + 1}`),
      );
      expect(res.status).toBe(401);
    }
    signInWithPassword.mockClear();
    const blocked = await POST(
      loginRequest("ana@example.com", "bad", "203.0.113.200"),
    );
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({
      ok: false,
      error: LOGIN_RATE_ERROR,
      code: "rate_limited",
    });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("corta por IP aunque las cuentas cambien", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    for (let i = 0; i < LOGIN_MAX_PER_IP; i += 1) {
      const res = await POST(
        loginRequest(`user${i}@example.com`, "bad", "198.51.100.8"),
      );
      expect(res.status).toBe(401);
    }
    signInWithPassword.mockClear();
    const blocked = await POST(
      loginRequest("otro@example.com", "bad", "198.51.100.8"),
    );
    expect(blocked.status).toBe(429);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("borra la cookie de visitante cuando el acceso es válido", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(loginRequest("ana@example.com", "secret", "203.0.113.9"));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie") ?? "").toMatch(/gdw_visitor=/);
    expect(await res.json()).toEqual({ ok: true });
  });
});
