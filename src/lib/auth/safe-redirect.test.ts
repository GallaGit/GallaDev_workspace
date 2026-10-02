import { describe, expect, it } from "vitest";
import { safeAppPath } from "./safe-redirect";

describe("safeAppPath", () => {
  it("acepta rutas de la app", () => {
    expect(safeAppPath("/leads")).toBe("/leads");
    expect(safeAppPath("/leads?queue=faltan_datos")).toBe(
      "/leads?queue=faltan_datos",
    );
    expect(safeAppPath("/inbox")).toBe("/inbox");
    expect(safeAppPath("/")).toBe("/");
  });

  it("rechaza otro origen, esquema y barra doble o invertida", () => {
    expect(safeAppPath("//evil.example")).toBe("/");
    expect(safeAppPath("/\\evil.example")).toBe("/");
    expect(safeAppPath("https://evil.example")).toBe("/");
    expect(safeAppPath("https://evil.example/leads")).toBe("/");
    expect(safeAppPath("/%2f%2fevil.example")).toBe("/");
    expect(safeAppPath("/leads/../../..//evil.example")).toBe("/");
    expect(safeAppPath(null)).toBe("/");
    expect(safeAppPath("/no-existe")).toBe("/");
  });
});
