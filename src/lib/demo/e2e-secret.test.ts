import { describe, expect, it } from "vitest";
import { e2eDemoSessionSecret } from "./e2e-secret";

describe("e2eDemoSessionSecret", () => {
  it("usa el valor del entorno si ya es largo", () => {
    expect(e2eDemoSessionSecret("un-secreto-de-prueba-largo")).toBe(
      "un-secreto-de-prueba-largo",
    );
  });

  it("genera un valor solo de CI si falta o es corto", () => {
    const first = e2eDemoSessionSecret("");
    const second = e2eDemoSessionSecret("corto");
    expect(first.startsWith("ci-e2e-only-")).toBe(true);
    expect(first.length).toBeGreaterThanOrEqual(16);
    expect(second.startsWith("ci-e2e-only-")).toBe(true);
    expect(first).not.toBe(second);
  });
});
