import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // vmThreads evita "failed to find the current suite" en Vitest 4.1.11
    // con Node 22 + Git Bash/Windows. Mantiene aislamiento sin fork de proceso.
    pool: "vmThreads",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // Thresholds are goals in TEST_PLAN; enforce as coverage grows.
      include: [
        "src/lib/domain/lead.ts",
        "src/lib/geo/cities.ts",
        "src/lib/ai/pain-analysis.ts",
        "src/lib/leads/**/*.ts",
        "src/lib/utils/email-plain.ts",
      ],
      exclude: [
        "node_modules/",
        "src/**/*.d.ts",
        "src/**/*.test.{ts,tsx}",
        "vitest.setup.ts",
        ".next/",
        "dist/",
      ],
    },
    globals: false,
    // sanitize-html no carga en vmThreads (htmlparser2 es ESM). Esos tests
    // viven en vitest.sanitize.config.mts con pool forks. El include de un
    // proyecto inline se mezcla con este y volvería a correr toda la suite.
    projects: [
      {
        extends: true,
        test: {
          name: "vm",
          pool: "vmThreads",
          exclude: [
            "src/lib/email/sanitize-email-html.test.ts",
            "src/lib/email/sanitize-html-cjs.test.ts",
            "src/lib/email/send-compose.test.ts",
            "src/lib/email/send-reply.test.ts",
          ],
        },
      },
      "./vitest.sanitize.config.mts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
      // El paquete `server-only` no está instalado y, si lo estuviera, lanzaría
      // en el runner de Vitest. El stub permite importar rutas de servidor.
      "server-only": path.resolve(rootDir, "./src/test/server-only-stub.ts"),
    },
  },
});
