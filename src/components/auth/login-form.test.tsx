import { cleanup, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/app/login/login-form";
import { LOGIN_GENERIC_ERROR, LOGIN_RATE_ERROR } from "@/lib/auth/login-limit";
import { renderWithIntl } from "@/test/i18n-wrapper";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh, replace: vi.fn() }),
  usePathname: () => "/login",
  useSearchParams: () => ({ get: () => null }),
}));

beforeEach(() => {
  cleanup();
  push.mockReset();
  refresh.mockReset();
});

describe("LoginForm", () => {
  it("no muestra el texto de Auth y usa el endpoint del servidor", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ ok: false, error: "Email not confirmed" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    renderWithIntl(<LoginForm />);
    fireEvent.change(screen.getByTestId("login-email"), {
      target: { value: "ana@example.com" },
    });
    fireEvent.change(screen.getByTestId("login-password"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByTestId("login-submit"));
    expect(await screen.findByRole("alert")).toHaveTextContent(LOGIN_GENERIC_ERROR);
    expect(screen.queryByText(/not confirmed/i)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("muestra el aviso de cupo sin repetir el cuerpo de Auth", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 429,
        json: async () => ({
          ok: false,
          error: "Email not confirmed",
          code: "rate_limited",
        }),
      })),
    );
    renderWithIntl(<LoginForm />);
    fireEvent.change(screen.getByTestId("login-email"), {
      target: { value: "ana@example.com" },
    });
    fireEvent.change(screen.getByTestId("login-password"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByTestId("login-submit"));
    expect(await screen.findByRole("alert")).toHaveTextContent(LOGIN_RATE_ERROR);
    expect(screen.queryByText(/not confirmed/i)).not.toBeInTheDocument();
  });
});
