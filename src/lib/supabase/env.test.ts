import { afterEach, describe, expect, it } from "vitest";
import { getActiveProvider, leadsDbProvider } from "./env";

afterEach(() => {
  delete process.env.LEADS_DB_PROVIDER;
});

describe("leadsDbProvider", () => {
  it("default supabase sin env (fuente de verdad actual)", () => {
    expect(leadsDbProvider()).toBe("supabase");
    expect(getActiveProvider()).toBe("supabase");
  });

  it("notion solo con LEADS_DB_PROVIDER=notion explícito (legado)", () => {
    process.env.LEADS_DB_PROVIDER = "Notion";
    expect(leadsDbProvider()).toBe("notion");
    expect(getActiveProvider()).toBe("notion");
  });

  it("cualquier otro valor cae a supabase", () => {
    process.env.LEADS_DB_PROVIDER = "postgres";
    expect(leadsDbProvider()).toBe("supabase");
  });
});
