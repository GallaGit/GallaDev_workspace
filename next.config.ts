import type { NextConfig } from "next";

function buildCsp(): string {
  // Next.js/React necesitan 'unsafe-eval' en desarrollo para reconstruir
  // callstacks. En producción la app no lo usa y la CSP sigue estricta.
  const scriptSrc =
    process.env.NODE_ENV === "production"
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

const nextConfig: NextConfig = {
  // Standalone solo para Docker/self-host (lo exige el Dockerfile).
  // En Vercel se usa su output nativo: standalone ahí rompe el trace
  // `.next/next-server.js.nft.json` y tumba el build. Vercel pone VERCEL=1.
  ...(process.env.VERCEL ? {} : { output: "standalone" }),

  // M1 (GEM_ROADMAP 1.3): cabeceras de seguridad en todas las rutas.
  // CSP conservadora: Next.js requiere 'unsafe-inline' en scripts/estilos
  // para hidratación; el resto queda restringido al propio origen.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: buildCsp(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
