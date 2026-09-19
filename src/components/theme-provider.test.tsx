import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ThemeProvider, useTheme } from "@/components/theme-provider";

const STORAGE_KEY = "lead-crm-theme";

function ThemeProbe() {
  const { theme, setTheme, mounted } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="mounted">{mounted ? "yes" : "no"}</span>
      <button type="button" onClick={() => setTheme("light")}>
        light
      </button>
      <button type="button" onClick={() => setTheme("dark")}>
        dark
      </button>
    </div>
  );
}

describe("theme system", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.style.colorScheme = "";
    vi.mocked(window.localStorage.getItem).mockReset();
    vi.mocked(window.localStorage.setItem).mockReset();
  });

  afterEach(() => {
    document.documentElement.classList.remove("light", "dark");
  });

  it("globals.css configures class-based dark: variant for ThemeProvider", () => {
    const css = readFileSync(
      resolve(__dirname, "../app/globals.css"),
      "utf8",
    );
    expect(css).toMatch(/@custom-variant\s+dark\s*\(\s*&:where\(\.dark/);
  });

  it("applies light class on html and color-scheme when setTheme(light)", async () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue("dark");

    const { getByText, getByTestId } = render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(getByTestId("mounted").textContent).toBe("yes");
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => {
      getByText("light").click();
    });

    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      "light",
    );
    expect(getByTestId("theme").textContent).toBe("light");
  });

  it("restores stored light theme onto html on mount", async () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue("light");

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(document.documentElement.classList.contains("light")).toBe(true);
    });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
  });
});
