import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20261002180000_least_privilege_signup_and_lead_rls.sql",
);

describe("migración least-privilege", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("el alta nueva no recibe un rol de equipo", () => {
    const fn = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.handle_new_user"));
    const body = fn.slice(0, fn.indexOf("$$;"));
    expect(body).toMatch(/VALUES \(NEW\.id, NULL\)/);
    expect(body).not.toMatch(/raw_user_meta_data/);
    expect(body).not.toMatch(/Seller/);
    expect(sql).not.toMatch(/UPDATE public\.profiles SET role/i);
  });

  it("Seller solo entra si responsable es su id; Viewer sigue leyendo", () => {
    expect(sql).not.toMatch(/responsable IS NULL/i);
    expect(sql).toMatch(/current_app_role\(\) = 'Viewer'/);
    expect(sql).toMatch(/responsable = auth\.uid\(\)/);
    expect(sql).toMatch(/l\.responsable = auth\.uid\(\)/);
  });

  it("deja el rol nullable y sin default de Viewer", () => {
    expect(sql).toMatch(/ALTER COLUMN role DROP NOT NULL/);
    expect(sql).toMatch(/ALTER COLUMN role DROP DEFAULT/);
  });
});
