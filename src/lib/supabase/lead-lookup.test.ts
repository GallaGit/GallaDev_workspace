import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { leadLookupColumns } from "./lead-lookup";
import { SupabaseLeadRepository } from "./supabase-lead-repository";

describe("leadLookupColumns", () => {
  it("consulta el uuid en id y en notion_page_id, por separado", () => {
    expect(
      leadLookupColumns("ed07cdd4-c542-4f9a-8b8e-bd73e358c6cd"),
    ).toEqual(["id", "notion_page_id"]);
  });

  it("acepta un page id de Notion de 32 hex", () => {
    expect(leadLookupColumns("ed07cdd4c5424f9a8b8ebd73e358c6cd")).toEqual([
      "notion_page_id",
    ]);
  });

  it("no consulta un id con metacaracteres de filtro", () => {
    expect(leadLookupColumns("id.eq.1,notion_page_id.neq.null")).toEqual([]);
    expect(leadLookupColumns("")).toEqual([]);
  });
});

describe("SupabaseLeadRepository.get", () => {
  it("exige un cliente y no interpola el id en un filtro or", async () => {
    expect(
      () => new SupabaseLeadRepository(undefined as unknown as SupabaseClient),
    ).toThrow(/cliente/);

    const calls: { column: string; value: string }[] = [];
    const sb = {
      from: () => {
        const query = {
          select: () => query,
          eq: (column: string, value: string) => {
            calls.push({ column, value });
            return query;
          },
          or: () => {
            throw new Error("or");
          },
          limit: () => query,
          maybeSingle: async () => ({ data: null, error: null }),
        };
        return query;
      },
    } as unknown as SupabaseClient;

    const repo = new SupabaseLeadRepository(sb);
    await expect(repo.get("id.eq.1,or.status.eq.Cliente")).resolves.toBeNull();
    expect(calls).toEqual([]);

    await repo.get("ed07cdd4-c542-4f9a-8b8e-bd73e358c6cd");
    expect(calls.map((call) => call.column)).toEqual(["id", "notion_page_id"]);
    expect(calls.every((call) => !call.value.includes(","))).toBe(true);
  });
});
