import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * sanitize-html 2.17.6+ depende de htmlparser2 ESM-only. En el runtime de
 * Vercel `require("sanitize-html")` lanza ERR_REQUIRE_ESM y la ruta responde
 * 500 con el cuerpo vacío. Este hijo es un proceso Node real, sin require(esm).
 * Tiene que fallar en 2.18.0 y pasar con 2.17.5 (htmlparser2 10, build CJS).
 */
describe("sanitize-html se puede requerir en CommonJS", () => {
  it("sale 0 con --no-experimental-require-module", () => {
    let stdout = "";
    try {
      stdout = execFileSync(
        process.execPath,
        ["--no-experimental-require-module", "-e", "require('sanitize-html')"],
        { encoding: "utf8", cwd: process.cwd() },
      );
    } catch (error) {
      const failed = error as { status?: number | null; stderr?: unknown };
      const stderr =
        typeof failed.stderr === "string"
          ? failed.stderr
          : String(failed.stderr ?? error);
      throw new Error(
        `require('sanitize-html') salió ${failed.status ?? "null"}: ${stderr}`,
      );
    }
    // execFileSync solo vuelve si el proceso terminó en 0.
    expect(stdout).toBe("");
  }, 20_000);
});
