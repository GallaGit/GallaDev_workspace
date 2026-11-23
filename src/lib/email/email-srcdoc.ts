/**
 * Nonce fijo del único <style> que inyectamos. El sanitizador ya descarta
 * <style> y los atributos style del correo, así que nada más lo lleva: la CSP
 * del iframe solo admite nuestra hoja y bloquea cualquier otro estilo.
 */
const FRAME_STYLE_NONCE = "gdw-email-frame";

/**
 * Hoja del iframe: el correo cabe siempre en el ancho disponible (móvil
 * incluido). Sin desplazamiento horizontal del documento: las palabras y URLs
 * largas se parten, `pre`/`code` se ajustan y, si una tabla fuera ancha, solo
 * esa tabla se desplaza dentro de su propia caja.
 */
export const EMAIL_FRAME_CSS = [
  "*,*::before,*::after{box-sizing:border-box}",
  "html,body{margin:0;max-width:100%;overflow-x:hidden}",
  "body{padding:8px;font:14px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1f2937;overflow-wrap:anywhere;word-break:break-word}",
  "div,p,span,blockquote,pre,ul,ol,li,h1,h2,h3,h4,h5,h6,hr{max-width:100%}",
  "a{overflow-wrap:anywhere;word-break:break-all}",
  "img,video,svg,canvas{max-width:100%;height:auto}",
  "pre,code{white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;max-width:100%}",
  "table{display:block;max-width:100%;overflow-x:auto;border-collapse:collapse}",
  "td,th{overflow-wrap:anywhere}",
  "blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #d1d5db}",
  "ul,ol{padding-left:1.25em}",
].join("");

/**
 * Documento del iframe del correo. El HTML ya viene saneado en servidor.
 * La CSP interna y el sandbox del iframe (sin scripts) son la segunda red.
 */
export function emailHtmlSrcDoc(safeHtml: string): string {
  return [
    "<!DOCTYPE html><html><head>",
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'none'; script-src 'none'; style-src 'nonce-${FRAME_STYLE_NONCE}'; font-src 'none'; form-action 'none'; base-uri 'none'; connect-src 'none'">`,
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<style nonce="${FRAME_STYLE_NONCE}">${EMAIL_FRAME_CSS}</style>`,
    "</head><body>",
    safeHtml,
    "</body></html>",
  ].join("");
}
