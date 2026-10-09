import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
const fileName = "20261009180000_email_thread_inbox_state.sql";

describe("migración de estado de bandeja (Correo tipo Gmail)", () => {
  const sql = readFileSync(path.join(migrationsDir, fileName), "utf8");
  const code = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  it("añade archived_at, trashed_at, last_snippet y has_attachments", () => {
    expect(code).toMatch(/ADD COLUMN IF NOT EXISTS archived_at timestamptz/);
    expect(code).toMatch(/ADD COLUMN IF NOT EXISTS trashed_at timestamptz/);
    expect(code).toMatch(/ADD COLUMN IF NOT EXISTS last_snippet text/);
    expect(code).toMatch(
      /ADD COLUMN IF NOT EXISTS has_attachments boolean NOT NULL DEFAULT false/,
    );
  });

  it("no abre RLS ni concede permisos nuevos", () => {
    expect(code).not.toMatch(/DISABLE ROW LEVEL SECURITY/i);
    expect(code).not.toMatch(/NO FORCE ROW LEVEL SECURITY/i);
    expect(code).not.toMatch(/CREATE POLICY/i);
    expect(code).not.toMatch(/DROP POLICY/i);
    expect(code).not.toMatch(/\bGRANT\b/i);
    expect(code).not.toMatch(/SECURITY DEFINER/i);
  });

  it("las funciones de trigger son INVOKER y se revocan a PUBLIC/anon/authenticated", () => {
    const functions = [
      ...code.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(\)/g),
    ].map((m) => m[1]);
    expect(functions.length).toBeGreaterThan(0);
    for (const fn of functions) {
      expect(code).toContain(`REVOKE ALL ON FUNCTION public.${fn}() FROM PUBLIC;`);
      expect(code).toContain(
        `REVOKE ALL ON FUNCTION public.${fn}() FROM anon, authenticated;`,
      );
    }
    expect(code.match(/SECURITY INVOKER/g)?.length).toBe(functions.length);
  });

  it("no borra datos (la purga de papelera queda para más adelante)", () => {
    expect(code).not.toMatch(/\bDELETE\b/i);
    expect(code).not.toMatch(/\bTRUNCATE\b/i);
    expect(code).not.toMatch(/DROP TABLE/i);
    expect(sql).toMatch(/30 días/);
  });

  it("es un archivo nuevo, no reescribe migraciones anteriores", () => {
    const names = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));
    expect(names.filter((name) => name === fileName)).toHaveLength(1);
    expect(names.some((name) => name < fileName)).toBe(true);
  });
});
