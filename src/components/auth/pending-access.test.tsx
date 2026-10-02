import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PendingAccess } from "./pending-access";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signOut: vi.fn(async () => ({ error: null })) },
  }),
}));

beforeEach(() => {
  cleanup();
});

describe("PendingAccess", () => {
  it("explica que falta un rol y ofrece cerrar sesión", () => {
    render(<PendingAccess />);
    expect(screen.getByRole("heading", { name: "Acceso pendiente" })).toBeInTheDocument();
    expect(screen.getByText(/no puedes ver leads/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
  });
});
