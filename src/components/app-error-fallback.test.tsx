import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppError from "@/app/error";
import GlobalError from "@/app/global-error";

afterEach(() => {
  cleanup();
});

describe("error boundary", () => {
  it("muestra el fallback y reintenta sin volcar el mensaje", () => {
    const retry = vi.fn();
    const error = new Error(
      "fallo sk-live-secret user@example.com",
    ) as Error & { digest?: string };
    error.digest = "abc123";
    render(<AppError error={error} retry={retry} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Algo ha fallado" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ref. abc123")).toBeInTheDocument();
    expect(screen.queryByText(/sk-live-secret/)).not.toBeInTheDocument();
    expect(screen.queryByText(/user@example.com/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Ir al inicio" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("omite la referencia si no hay digest", () => {
    render(<AppError error={new Error("x")} retry={vi.fn()} />);
    expect(screen.queryByText(/Ref\./)).not.toBeInTheDocument();
  });

  it("global-error usa el mismo fallback", () => {
    render(<GlobalError error={new Error("layout")} retry={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "Algo ha fallado" }),
    ).toBeInTheDocument();
  });
});
