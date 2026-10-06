import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { render } from "@testing-library/react";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import es from "../../messages/es.json";
import en from "../../messages/en.json";

const refresh = vi.fn();
const setLocaleMock = vi.fn(async (locale: string) => locale);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh, replace: vi.fn() }),
}));

vi.mock("@/app/actions/set-locale", () => ({
  setLocale: (locale: string) => setLocaleMock(locale),
}));

beforeEach(() => {
  cleanup();
  refresh.mockReset();
  setLocaleMock.mockClear();
});

function renderSwitcher(locale: "es" | "en") {
  const messages = locale === "es" ? es : en;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LocaleSwitcher />
    </NextIntlClientProvider>,
  );
}

describe("LocaleSwitcher", () => {
  it("muestra ES/EN y cambia a inglés", async () => {
    renderSwitcher("es");
    expect(screen.getByTestId("locale-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("locale-es")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByTestId("locale-en"));
    await waitFor(() => {
      expect(setLocaleMock).toHaveBeenCalledWith("en");
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("en inglés marca EN como activo", () => {
    renderSwitcher("en");
    expect(screen.getByTestId("locale-en")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("locale-es")).toHaveAttribute("aria-pressed", "false");
  });
});
