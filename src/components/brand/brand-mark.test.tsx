import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/i18n-wrapper";
import { BrandMark } from "./brand-mark";

afterEach(() => {
  cleanup();
});

describe("BrandMark", () => {
  it("muestra el isotipo de GallaDev para tema claro y oscuro", () => {
    renderWithIntl(<BrandMark />);
    expect(screen.getByAltText("GallaDev")).toHaveAttribute(
      "src",
      "/brand/logo.png",
    );
    expect(screen.getByAltText("").getAttribute("src")).toBe(
      "/brand/logo-light.png",
    );
  });
});
