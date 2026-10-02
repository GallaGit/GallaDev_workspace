import { describe, expect, it } from "vitest";
import {
  classifySupabaseError,
  dbStatusMessage,
  isDbStatus,
} from "./health";

describe("classifySupabaseError", () => {
  it("ok implícito no aplica: null/raro → down", () => {
    expect(classifySupabaseError(null)).toBe("down");
    expect(classifySupabaseError("boom")).toBe("down");
  });

  it("401/403/JWT → auth", () => {
    expect(classifySupabaseError({ status: 401, message: "x" })).toBe("auth");
    expect(classifySupabaseError({ status: 403, message: "x" })).toBe("auth");
    expect(classifySupabaseError({ message: "invalid JWT expired" })).toBe("auth");
    expect(classifySupabaseError({ message: "Invalid API key" })).toBe("auth");
    expect(classifySupabaseError({ code: "42501", message: "permission denied" })).toBe("auth");
  });

  it("tabla/schema ausente → config", () => {
    expect(
      classifySupabaseError({
        code: "PGRST205",
        message: "Could not find the table 'public.leads' in the schema cache",
      }),
    ).toBe("config");
  });

  it("red/5xx → down", () => {
    expect(classifySupabaseError({ status: 500, message: "x" })).toBe("down");
    expect(classifySupabaseError(new TypeError("fetch failed"))).toBe("down");
  });
});


describe("dbStatusMessage", () => {
  it("es fijo y no arrastra el texto de Postgres", () => {
    expect(dbStatusMessage("ok")).toBe("Supabase conectado");
    expect(dbStatusMessage("config")).toBe(
      "Falta configuración o el esquema de la base",
    );
    expect(dbStatusMessage("down")).toBe("Supabase no disponible");
    expect(dbStatusMessage("auth")).not.toMatch(/relation|postgres|jwt/i);
  });
});

describe("isDbStatus", () => {
  it("valida los 4 estados", () => {
    for (const s of ["ok", "auth", "config", "down"]) expect(isDbStatus(s)).toBe(true);
    expect(isDbStatus("unknown")).toBe(false);
  });
});
