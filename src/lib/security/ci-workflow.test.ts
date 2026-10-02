import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  path.resolve(process.cwd(), ".github/workflows/ci.yml"),
  "utf8",
);
const playwright = readFileSync(
  path.resolve(process.cwd(), "playwright.config.ts"),
  "utf8",
);

describe("workflow de CI", () => {
  it("declara permisos mínimos y sube el informe solo en E2E", () => {
    expect(workflow).toMatch(/permissions:\s*\n\s*contents:\s*read/);
    const e2e = workflow.slice(workflow.indexOf("e2e:"));
    expect(e2e).toMatch(/actions:\s*write/);
    expect(e2e).toMatch(/contents:\s*read/);
  });

  it("no fija el secreto de la demo en claro", () => {
    expect(workflow).toMatch(/secrets\.E2E_DEMO_SESSION_SECRET/);
    expect(workflow).not.toMatch(/DEMO_SESSION_SECRET:\s*"[^$][^"]+"/);
    expect(playwright).not.toMatch(/DEMO_SESSION_SECRET:\s*'[^']+'/);
    expect(playwright).toMatch(/e2eDemoSessionSecret/);
  });
});
