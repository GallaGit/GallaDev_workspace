import { afterEach, describe, expect, it } from "vitest";
import { getActiveProvider, leadsDbProvider } from "./env";

afterEach(() => {
  delete process.env.LEADS_DB_PROVIDER;
});

describe("leadsDbProvider", () => {
  it("default notion sin env", () => {
    expect(leadsDbProvider()).toBe("notion");
    expect(getActiveProvider()).toBe("notion");
  });

  it("supabase con LEADS_DB_PROVIDER=supabase (case-insensitive)", () => {
    process.env.LEADS_DB_PROVIDER = "Supabase";
    expect(leadsDbProvider()).toBe("supabase");
    expect(getActiveProvider()).toBe("supabase");
  });

  it("cualquier otro valor cae a notion", () => {
    process.env.LEADS_DB_PROVIDER = "postgres";
    expect(leadsDbProvider()).toBe("notion");
  });
});
