import { describe, expect, it } from "vitest";
import { emailHtmlSrcDoc } from "./email-srcdoc";
import {
  MAX_EMAIL_BODY_CHARS,
  prepareEmailHtml,
  prepareStoredEmailBodies,
  sanitizeEmailHtml,
} from "./sanitize-email-html";

describe("sanitizeEmailHtml", () => {
  it("quita script, handlers, iframes, formularios y estilos", () => {
    const clean = sanitizeEmailHtml(
      [
        "<p>Hola</p>",
        "<script>alert(1)</script>",
        "<img src=x onerror=\"alert(1)\">",
        "<a href=\"javascript:alert(1)\">js</a>",
        "<iframe src=\"https://evil.test\"></iframe>",
        "<form action=\"https://evil.test\"><input></form>",
        "<style>body{background:url(https://evil.test)}</style>",
        "<div style=\"background:url(https://evil.test)\">x</div>",
        "<svg><script>alert(1)</script></svg>",
        "<a href=\"https://ok.test/a\">enlace</a>",
      ].join(""),
    );

    expect(clean).toContain("<p>Hola</p>");
    expect(clean).toContain("[imagen bloqueada]");
    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/onerror/i);
    expect(clean).not.toMatch(/javascript:/i);
    expect(clean).not.toMatch(/<iframe/i);
    expect(clean).not.toMatch(/<form/i);
    expect(clean).not.toMatch(/<style/i);
    expect(clean).not.toMatch(/\sstyle=/i);
    expect(clean).not.toMatch(/<svg/i);
    expect(clean).not.toMatch(/https:\/\/evil/i);
    expect(clean).toContain('href="https://ok.test/a"');
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('rel="noopener noreferrer nofollow"');
  });

  it("bloquea imágenes remotas, srcset, data y css de fondo", () => {
    const clean = sanitizeEmailHtml(
      '<p>t</p><img src="https://pixel.test/a.png" srcset="https://pixel.test/2.png 2x"><img src="data:image/gif;base64,R0lGODlh"><table background="https://pixel.test/b.png"></table>',
    );
    expect(clean).not.toMatch(/https:\/\/pixel/i);
    expect(clean).not.toMatch(/data:image/i);
    expect(clean).not.toMatch(/srcset/i);
    expect(clean).toContain("[imagen bloqueada]");
  });

  it("acota el cuerpo antes de guardarlo", () => {
    const huge = `<p>${"a".repeat(MAX_EMAIL_BODY_CHARS + 50)}</p>`;
    const stored = prepareStoredEmailBodies(huge, "b".repeat(MAX_EMAIL_BODY_CHARS + 10));
    expect(stored.html!.length).toBeLessThanOrEqual(MAX_EMAIL_BODY_CHARS + 20);
    expect(stored.text!.length).toBe(MAX_EMAIL_BODY_CHARS);
  });

  it("devuelve null si el html queda vacío", () => {
    expect(prepareEmailHtml("<script>alert(1)</script>")).toBeNull();
    expect(prepareEmailHtml(null)).toBeNull();
  });
});

describe("emailHtmlSrcDoc", () => {
  it("mete una CSP que no permite scripts ni imágenes", () => {
    const doc = emailHtmlSrcDoc("<p>Hola</p>");
    expect(doc).toContain("script-src 'none'");
    expect(doc).toContain("img-src 'none'");
    expect(doc).toContain("<p>Hola</p>");
  });
});
