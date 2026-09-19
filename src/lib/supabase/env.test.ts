import { afterEach, describe, expect, it } from "vitest";
import { getActiveProvider, leadsDbProvider } from "./env";

afterEach(() => {
  delete process.env.LEADS_DB_PROVIDER;
});

describe("leadsDbProvider", () => {
  it("siempre supabase (Notion runtime eliminado)", () => {
    expect(leadsDbProvider()).toBe("supabase");
    expect(getActiveProvider()).toBe("supabase");
  });

  it("ignora LEADS_DB_PROVIDER=notion (ya no hay runtime Notion)", () => {
    process.env.LEADS_DB_PROVIDER = "notion";
    expect(leadsDbProvider()).toBe("supabase");
    expect(getActiveProvider()).toBe("supabase");
  });

  it("cualquier otro valor sigue siendo supabase", () => {
    process.env.LEADS_DB_PROVIDER = "postgres";
    expect(leadsDbProvider()).toBe("supabase");
  });
});
