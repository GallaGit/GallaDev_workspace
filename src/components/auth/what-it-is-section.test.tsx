import { cleanup, screen } from "@testing-library/react";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import {
  WHAT_IT_IS_SHOTS,
  WhatIsItSection,
} from "@/components/auth/what-it-is-section";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";

afterEach(() => {
  cleanup();
});

function renderSection(locale: "es" | "en") {
  const messages = locale === "es" ? es : en;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <WhatIsItSection />
    </NextIntlClientProvider>,
  );
}

describe("WhatIsItSection", () => {
  it("muestra el título, el texto y las cuatro capturas en español", () => {
    renderSection("es");
    expect(screen.getByTestId("what-it-is")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "¿Qué es?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "GallaDev Workspace es un CRM para revisar, cualificar y gestionar leads de asesorías y gestorías.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/análisis de dolores por IA/)).toBeInTheDocument();
    expect(screen.getByText(/No hay alta pública/)).toBeInTheDocument();

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(WHAT_IT_IS_SHOTS.length);
    for (const shot of WHAT_IT_IS_SHOTS) {
      const alt = es.auth.whatIsIt.shots[shot.key].alt;
      const img = screen.getByRole("img", { name: alt });
      expect(img).toHaveAttribute("src", shot.src);
      expect(img).toHaveAttribute("loading", "lazy");
      expect(img).toHaveAttribute("decoding", "async");
    }
    expect(screen.getByText("Lista de leads.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Empresas ficticias, con filtro y estado. No son clientes reales.",
      ),
    ).toBeInTheDocument();
  });

  it("muestra el título y el texto en inglés", () => {
    renderSection("en");
    expect(
      screen.getByRole("heading", { level: 2, name: "What is it?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /GallaDev Workspace is a CRM for reviewing, qualifying, and managing leads/,
      ),
    ).toBeInTheDocument();
    const alt = en.auth.whatIsIt.shots.leads.alt;
    expect(screen.getByRole("img", { name: alt })).toHaveAttribute(
      "src",
      "/what-it-is/leads-light.webp",
    );
    expect(screen.getByText("Lead list.")).toBeInTheDocument();
  });
});
