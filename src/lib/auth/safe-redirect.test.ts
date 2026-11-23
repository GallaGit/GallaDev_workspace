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

  it("acepta las rutas por carpeta de /correo con su cuenta", () => {
    expect(safeAppPath("/correo")).toBe("/correo");
    expect(safeAppPath("/correo/recibidos")).toBe("/correo/recibidos");
    expect(safeAppPath("/correo/papelera?cuenta=hola")).toBe(
      "/correo/papelera?cuenta=hola",
    );
    expect(
      safeAppPath("/correo/enviados/11111111-1111-4111-8111-111111111111?cuenta=ociel"),
    ).toBe("/correo/enviados/11111111-1111-4111-8111-111111111111?cuenta=ociel");
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
