import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // sanitize-html se deja fuera del bundle para que el runtime lo cargue
  // con require(), igual que el test de regresión. Va fijado en 2.17.5:
  // 2.17.6+ arrastra htmlparser2 ESM-only y ese require lanza
  // ERR_REQUIRE_ESM en Vercel (la ruta responde 500 con cuerpo vacío).
  serverExternalPackages: ["sanitize-html"],

  // Standalone solo para Docker/self-host (lo exige el Dockerfile).
  // En Vercel se usa su output nativo: standalone ahí rompe el trace
  // `.next/next-server.js.nft.json` y tumba el build. Vercel pone VERCEL=1.
  ...(process.env.VERCEL ? {} : { output: "standalone" }),

  // M1 (GEM_ROADMAP 1.3): cabeceras de seguridad en todas las rutas.
  // La CSP vive en src/proxy.ts (nonce por petición). Aquí no se repite:
  // dos políticas CSP se aplican a la vez y una estática con
  // 'unsafe-inline' no aporta el nonce que Next necesita.
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
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
