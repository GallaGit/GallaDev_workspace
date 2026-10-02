import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
const fileName = "20261002200000_revoke_handle_new_user_execute.sql";

describe("migración SEC-014", () => {
  const sql = readFileSync(path.join(migrationsDir, fileName), "utf8");

  it("revoca EXECUTE de handle_new_user a PUBLIC, anon y authenticated", () => {
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.handle_new_user\(\) FROM PUBLIC/,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.handle_new_user\(\) FROM anon, authenticated/,
    );
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.handle_new_user/i);
  });

  it("es un archivo nuevo y no reescribe el trigger", () => {
    const names = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));
    expect(names.filter((name) => name === fileName)).toHaveLength(1);
    expect(names.some((name) => name < fileName)).toBe(true);
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION/);
    expect(sql).not.toMatch(/UPDATE public\.profiles/i);
  });
});
