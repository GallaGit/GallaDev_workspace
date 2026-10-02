/**
 * Documento del iframe del correo. El HTML ya viene saneado en servidor.
 * La CSP interna y el sandbox del iframe (sin scripts) son la segunda red.
 */
export function emailHtmlSrcDoc(safeHtml: string): string {
  return [
    "<!DOCTYPE html><html><head>",
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src \'none\'; script-src \'none\'; style-src \'none\'; font-src \'none\'; form-action \'none\'; base-uri \'none\'; connect-src \'none\'">',
    '<meta charset="utf-8">',
    "</head><body>",
    safeHtml,
    "</body></html>",
  ].join("");
}
