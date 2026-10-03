import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * sanitize-html (CJS) carga htmlparser2 (ESM). El pool vmThreads reimplementa
 * require() y no puede hacerlo. Estos tres tests corren en procesos Node reales.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    name: "sanitize-html",
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    pool: "forks",
    globals: false,
    include: [
      "src/lib/email/sanitize-email-html.test.ts",
      "src/lib/email/sanitize-html-cjs.test.ts",
      "src/lib/email/send-compose.test.ts",
      "src/lib/email/send-reply.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
      "server-only": path.resolve(rootDir, "./src/test/server-only-stub.ts"),
    },
  },
});
