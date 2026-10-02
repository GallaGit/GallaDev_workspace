/**
 * CSP por petición. El nonce lo genera `src/proxy.ts` y Next.js lo aplica
 * a sus scripts durante el render dinámico.
 *
 * `script-src` no incluye `'unsafe-inline'`: con nonce + strict-dynamic
 * el navegador ignora unsafe-inline. En desarrollo se añade `'unsafe-eval'`
 * porque React lo usa para reconstruir stacks.
 *
 * `style-src` conserva `'unsafe-inline'` y no lleva nonce. Un nonce en
 * style-src haría que el navegador ignore unsafe-inline, y la UI usa
 * atributos style (Tailwind y el tema). Los estilos en línea no ejecutan
 * script.
 *
 * `img-src` no permite `https:` ni `data:`: las imágenes remotas del correo
 * no deben cargarse aunque un filtro de HTML falle.
 */
export function buildContentSecurityPolicy(
  nonce: string,
  options?: { dev?: boolean },
): string {
  const dev = options?.dev ?? process.env.NODE_ENV === "development";
  const scriptSrc = [
    "script-src 'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    dev ? "'unsafe-eval'" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'self'",
  ].join("; ");
}
