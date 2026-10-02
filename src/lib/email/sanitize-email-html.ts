import "server-only";

// Fijado en package.json a 2.17.5. Desde 2.17.6 htmlparser2 es ESM-only
// y require() falla en el runtime de Vercel.
import sanitizeHtml from "sanitize-html";
import { MAX_EMAIL_BODY_CHARS } from "./limits";

export { MAX_EMAIL_BODY_CHARS };

const ALLOWED_TAGS = [
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
];

/**
 * Sanea HTML de correo con un parser (sanitize-html / htmlparser2).
 * Lista blanca de etiquetas. Sin script, sin handlers, sin iframes,
 * formularios ni estilos. Los enlaces salen con target y rel fijos.
 * Las imágenes se sustituyen por un texto: no hay src remoto ni data:.
 */
export function sanitizeEmailHtml(input: string): string {
  return sanitizeHtml(input.slice(0, MAX_EMAIL_BODY_CHARS), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      a: ["http", "https", "mailto"],
    },
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    nestingLimit: 30,
    transformTags: {
      a: (_tagName, attribs) => {
        const next: Record<string, string> = {
          target: "_blank",
          rel: "noopener noreferrer nofollow",
        };
        const href = attribs.href?.trim();
        if (href) next.href = href;
        if (attribs.title?.trim()) next.title = attribs.title.trim();
        return { tagName: "a", attribs: next };
      },
      img: () => ({
        tagName: "span",
        attribs: {},
        text: "[imagen bloqueada]",
      }),
    },
  }).trim();
}

export function capEmailText(input: string | null | undefined): string | null {
  if (input == null) return null;
  const capped = input.slice(0, MAX_EMAIL_BODY_CHARS);
  return capped.length > 0 ? capped : null;
}

export function prepareEmailHtml(input: string | null | undefined): string | null {
  if (input == null) return null;
  const clean = sanitizeEmailHtml(input);
  return clean.length > 0 ? clean : null;
}

export function prepareStoredEmailBodies(
  html: string | null | undefined,
  text: string | null | undefined,
): { html: string | null; text: string | null } {
  return {
    html: prepareEmailHtml(html),
    text: capEmailText(text),
  };
}
