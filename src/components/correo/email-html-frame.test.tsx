import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { EmailHtmlFrame } from "./thread-view";

beforeEach(() => {
  cleanup();
});

describe("EmailHtmlFrame", () => {
  it("renderiza el html en un iframe sin scripts", () => {
    render(<EmailHtmlFrame html="<p>Hola</p>" />);
    const frame = screen.getByTitle("Contenido del correo");
    expect(frame.tagName).toBe("IFRAME");
    expect(frame).toHaveAttribute("sandbox", "");
    const srcdoc = frame.getAttribute("srcdoc") ?? "";
    expect(srcdoc).toContain("script-src 'none'");
    expect(srcdoc).toContain("img-src 'none'");
    expect(srcdoc).toContain("<p>Hola</p>");
    expect(srcdoc).not.toContain("allow-scripts");
  });
});
