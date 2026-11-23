import { describe, expect, it } from "vitest";
import { EMAIL_FRAME_CSS, emailHtmlSrcDoc } from "./email-srcdoc";

describe("emailHtmlSrcDoc (vista móvil)", () => {
  const doc = emailHtmlSrcDoc("<p>Hola</p>");

  it("sigue sin permitir scripts, imágenes ni estilos ajenos", () => {
    expect(doc).toContain("script-src 'none'");
    expect(doc).toContain("img-src 'none'");
    expect(doc).toMatch(/style-src 'nonce-[\w-]+'/);
    expect(doc).not.toContain("unsafe-inline");
    expect(doc).toContain("<p>Hola</p>");
  });

  it("solo el <style> propio lleva el nonce de la CSP", () => {
    const nonce = /style-src 'nonce-([\w-]+)'/.exec(doc)?.[1];
    expect(doc).toContain(`<style nonce="${nonce}">`);
    expect(doc.match(/<style/g)).toHaveLength(1);
  });

  it("el correo cabe en el ancho: sin scroll horizontal y con ajuste de texto largo", () => {
    expect(EMAIL_FRAME_CSS).toContain("max-width:100%");
    expect(EMAIL_FRAME_CSS).toContain("overflow-wrap:anywhere");
    expect(EMAIL_FRAME_CSS).toContain("overflow-x:hidden");
    expect(EMAIL_FRAME_CSS).toMatch(/pre,code\{white-space:pre-wrap/);
    expect(EMAIL_FRAME_CSS).toMatch(/img[^{]*\{max-width:100%;height:auto\}/);
    // Una tabla ancha se desplaza solo dentro de su caja.
    expect(EMAIL_FRAME_CSS).toMatch(/table\{display:block;max-width:100%;overflow-x:auto/);
    expect(doc).toContain('name="viewport"');
  });
});
