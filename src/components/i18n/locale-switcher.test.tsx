import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { render } from "@testing-library/react";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";

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
  it("muestra ES y al clic cambia a inglés", async () => {
    renderSwitcher("es");
    const button = screen.getByTestId("locale-trigger");
    expect(screen.getByTestId("locale-switcher")).toBeInTheDocument();
    expect(button).toHaveAttribute("data-locale", "es");
    expect(button).toHaveTextContent("ES");
    expect(button).toHaveAttribute("aria-label", "Cambiar a English");
    expect(button).toHaveAttribute("title", "Cambiar a English");
    fireEvent.click(button);
    await waitFor(() => {
      expect(setLocaleMock).toHaveBeenCalledWith("en");
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("en inglés muestra EN y propone volver a español", () => {
    renderSwitcher("en");
    const button = screen.getByTestId("locale-trigger");
    expect(button).toHaveAttribute("data-locale", "en");
    expect(button).toHaveTextContent("EN");
    expect(button).toHaveAttribute("aria-label", "Switch to Español");
    expect(button).toHaveAttribute("title", "Switch to Español");
  });
});
