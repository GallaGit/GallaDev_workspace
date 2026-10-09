import { describe, expect, it } from "vitest";
import {
  MAX_SEARCH_CHARS,
  MAX_SEARCH_TERMS,
  buildTsQuery,
  parseSearchQuery,
  parseSearchScope,
  searchTerms,
} from "./thread-search";

describe("parseSearchQuery", () => {
  it("ausente o vacío = sin búsqueda", () => {
    expect(parseSearchQuery(null)).toEqual({ ok: true, q: null });
    expect(parseSearchQuery(undefined)).toEqual({ ok: true, q: null });
    expect(parseSearchQuery("   ")).toEqual({ ok: true, q: null });
  });

  it("recorta y colapsa espacios", () => {
    expect(parseSearchQuery("  hola   mundo ")).toEqual({ ok: true, q: "hola mundo" });
  });

  it("rechaza más de 200 caracteres", () => {
    expect(parseSearchQuery("a".repeat(MAX_SEARCH_CHARS))).toMatchObject({ ok: true });
    expect(parseSearchQuery("a".repeat(MAX_SEARCH_CHARS + 1))).toEqual({
      ok: false,
      error: "La búsqueda es demasiado larga",
    });
  });
});

describe("parseSearchScope", () => {
  it("solo «all» amplía; lo demás es la vista actual", () => {
    expect(parseSearchScope("all")).toBe("all");
    expect(parseSearchScope(" ALL ")).toBe("all");
    expect(parseSearchScope("everything")).toBe("view");
    expect(parseSearchScope(null)).toBe("view");
  });
});

describe("searchTerms / buildTsQuery", () => {
  it("palabras Unicode con prefijo unidas por AND", () => {
    expect(buildTsQuery("Presupuesto Señora")).toBe("presupuesto:* & señora:*");
    expect(buildTsQuery("información 2026")).toBe("información:* & 2026:*");
  });

  it("parte el email en palabras", () => {
    expect(searchTerms("ana.garcia@example.com")).toEqual([
      "ana",
      "garcia",
      "example",
      "com",
    ]);
  });

  it("neutraliza operadores y sintaxis de tsquery o SQL", () => {
    expect(buildTsQuery("a | b & !c <-> (d) 'e':*")).toBe(
      "a:* & b:* & c:* & d:* & e:*",
    );
    expect(buildTsQuery("'; DROP TABLE email_threads; --")).toBe(
      "drop:* & table:* & email:* & threads:*",
    );
    expect(buildTsQuery("!!! ()")).toBeNull();
    expect(buildTsQuery("")).toBeNull();
  });

  it("deduplica y limita el número de palabras", () => {
    expect(searchTerms("hola HOLA hola")).toEqual(["hola"]);
    const many = Array.from({ length: 20 }, (_, i) => `w${i}`).join(" ");
    expect(searchTerms(many)).toHaveLength(MAX_SEARCH_TERMS);
    expect(searchTerms("x".repeat(100))[0]).toHaveLength(64);
  });
});
