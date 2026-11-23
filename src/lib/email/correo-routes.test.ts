import { describe, expect, it } from "vitest";
import {
  CORREO_FOLDERS,
  accountToParam,
  correoPath,
  folderFromSlug,
  folderThreadView,
  isCorreoPath,
  parseAccountParam,
  parseCorreoPath,
  resolveFolderAlias,
} from "./correo-routes";

const ID = "11111111-1111-4111-8111-111111111111";

describe("rutas de /correo", () => {
  it("cada carpeta tiene su slug en español", () => {
    expect(CORREO_FOLDERS.map((f) => correoPath(f))).toEqual([
      "/correo/recibidos",
      "/correo/enviados",
      "/correo/archivados",
      "/correo/papelera",
      "/correo/borradores",
    ]);
  });

  it("folderFromSlug solo acepta los slugs canónicos", () => {
    expect(folderFromSlug("recibidos")).toBe("inbox");
    expect(folderFromSlug("PAPELERA")).toBe("trash");
    expect(folderFromSlug("inbox")).toBeNull();
    expect(folderFromSlug("spam")).toBeNull();
    expect(folderFromSlug(undefined)).toBeNull();
  });

  it("un slug no canónico cae en su carpeta equivalente o en Recibidos", () => {
    expect(resolveFolderAlias("sent")).toBe("sent");
    expect(resolveFolderAlias("trash")).toBe("trash");
    expect(resolveFolderAlias("borrador")).toBe("drafts");
    expect(resolveFolderAlias("spam")).toBe("inbox");
    expect(resolveFolderAlias("")).toBe("inbox");
  });

  it("Borradores no tiene vista de hilos", () => {
    expect(folderThreadView("drafts")).toBeNull();
    expect(folderThreadView("sent")).toBe("sent");
  });

  it("parseCorreoPath lee carpeta e hilo y tolera rutas raras", () => {
    expect(parseCorreoPath("/correo")).toEqual({ folder: "inbox", threadId: null });
    expect(parseCorreoPath("/correo/enviados")).toEqual({ folder: "sent", threadId: null });
    expect(parseCorreoPath(`/correo/archivados/${ID}`)).toEqual({
      folder: "archived",
      threadId: ID,
    });
    expect(parseCorreoPath("/correo/archivados/no-es-uuid").threadId).toBeNull();
    expect(parseCorreoPath(`/correo/borradores/${ID}`)).toEqual({
      folder: "drafts",
      threadId: null,
    });
    expect(parseCorreoPath("/correo/otra-cosa")).toEqual({ folder: "inbox", threadId: null });
  });

  it("la cuenta es un query con el local-part; lo desconocido es Todas", () => {
    expect(parseAccountParam(null)).toBe("all");
    expect(parseAccountParam("")).toBe("all");
    expect(parseAccountParam("todas")).toBe("all");
    expect(parseAccountParam("hola")).toBe("hola@galladev.com");
    expect(parseAccountParam("OCIEL")).toBe("ociel@galladev.com");
    expect(parseAccountParam("ociel@galladev.com")).toBe("ociel@galladev.com");
    expect(parseAccountParam("root")).toBe("all");
    expect(parseAccountParam("evil@example.com")).toBe("all");
  });

  it("correoPath combina carpeta, hilo y cuenta", () => {
    expect(correoPath("inbox", ID)).toBe(`/correo/recibidos/${ID}`);
    expect(correoPath("inbox", null, "hola@galladev.com")).toBe(
      "/correo/recibidos?cuenta=hola",
    );
    expect(correoPath("trash", ID, "ociel@galladev.com")).toBe(
      `/correo/papelera/${ID}?cuenta=ociel`,
    );
    expect(correoPath("drafts", ID)).toBe("/correo/borradores");
    expect(correoPath("sent", "no-uuid")).toBe("/correo/enviados");
    expect(accountToParam("all")).toBeNull();
  });

  it("isCorreoPath distingue /correo de /email", () => {
    expect(isCorreoPath("/correo")).toBe(true);
    expect(isCorreoPath("/correo/recibidos")).toBe(true);
    expect(isCorreoPath("/correos")).toBe(false);
    expect(isCorreoPath("/email")).toBe(false);
    expect(isCorreoPath(null)).toBe(false);
  });
});
