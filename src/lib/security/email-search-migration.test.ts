import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
const fileName = "20261010090000_email_search.sql";

describe("migración de búsqueda en Correo", () => {
  const sql = readFileSync(path.join(migrationsDir, fileName), "utf8");
  const code = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  it("añade search_tsv generado con índice GIN en mensajes e hilos", () => {
    for (const table of ["email_messages", "email_threads"]) {
      expect(code).toMatch(
        new RegExp(
          `ALTER TABLE public\\.${table}\\s+ADD COLUMN IF NOT EXISTS search_tsv tsvector\\s+GENERATED ALWAYS AS`,
        ),
      );
      expect(code).toMatch(new RegExp(`ON public\\.${table} USING GIN \\(search_tsv\\)`));
    }
    expect(code).toMatch(/to_tsvector\('spanish'::regconfig, left\(coalesce\(body_text/);
  });

  it("no toca RLS, grants ni datos", () => {
    expect(code).not.toMatch(/ROW LEVEL SECURITY/i);
    expect(code).not.toMatch(/POLICY/i);
    expect(code).not.toMatch(/\bGRANT\b|\bREVOKE\b/i);
    expect(code).not.toMatch(/\bDELETE\b|\bUPDATE public\b|\bTRUNCATE\b|DROP TABLE/i);
    expect(code).not.toMatch(/CREATE (OR REPLACE )?FUNCTION/i);
  });

  it("es un archivo nuevo, no reescribe migraciones anteriores", () => {
    const names = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));
    expect(names.filter((name) => name === fileName)).toHaveLength(1);
    expect(names.some((name) => name < fileName)).toBe(true);
  });
});
