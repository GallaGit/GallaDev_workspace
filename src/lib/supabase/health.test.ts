import { describe, expect, it } from "vitest";
import {
  classifyNotionMessage,
  classifySupabaseError,
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

describe("classifyNotionMessage", () => {
  it("ok → ok", () => {
    expect(classifyNotionMessage(true, "cualquier")).toBe("ok");
  });

  it("sin token → config", () => {
    expect(classifyNotionMessage(false, "Falta el token de Notion")).toBe("config");
  });

  it("401 → auth, resto → down", () => {
    expect(classifyNotionMessage(false, "API responded with 401")).toBe("auth");
    expect(classifyNotionMessage(false, "timeout de red")).toBe("down");
  });
});

describe("isDbStatus", () => {
  it("valida los 4 estados", () => {
    for (const s of ["ok", "auth", "config", "down"]) expect(isDbStatus(s)).toBe(true);
    expect(isDbStatus("unknown")).toBe(false);
  });
});
