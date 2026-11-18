import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
const fileName = "20261118220000_purge_trashed_email_threads.sql";
const olderFileName = "20261020100000_data_retention.sql";

describe("migración de purga de Papelera (30 días)", () => {
  const sql = readFileSync(path.join(migrationsDir, fileName), "utf8");
  const code = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  it("existe como archivo nuevo posterior a las migraciones anteriores", () => {
    const names = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));
    expect(names.filter((name) => name === fileName)).toHaveLength(1);
    expect(names.some((name) => name < fileName)).toBe(true);
  });

  it("indica que Ociel debe aplicarla manualmente antes de desplegar", () => {
    expect(sql).toMatch(/Ociel/);
    expect(sql).toMatch(/SQL Editor/i);
    expect(sql).toMatch(/ANTES DE DESPLEGAR/i);
    expect(sql).toMatch(/BEFORE deploy/i);
  });

  it("reemplaza la misma función y conserva la retención de leads", () => {
    expect(code).toMatch(
      /CREATE OR REPLACE FUNCTION public\.purge_expired_personal_data\(dry_run boolean DEFAULT true\)/,
    );
    expect(code).toMatch(/interval '12 months'/);
    expect(code).toMatch(/interval '6 years'/);
    expect(code).toMatch(/DELETE FROM public\.leads/);
  });

  it("selecciona los hilos de Papelera con trashed_at de hace 30 días", () => {
    expect(code).toMatch(/expired_trash_threads/);
    expect(code).toMatch(/trashed_at IS NOT NULL/);
    expect(code).toMatch(/trashed_at < now\(\) - interval '30 days'/);
    expect(sql).toMatch(/TRASH_RETENTION_DAYS/);
  });

  it("cuenta por separado hilos, mensajes y adjuntos de Papelera", () => {
    expect(code).toMatch(/v_trashed_threads integer/);
    expect(code).toMatch(/v_trashed_messages integer/);
    expect(code).toMatch(/v_trashed_attachments integer/);
    for (const key of [
      "trashed_threads",
      "trashed_messages",
      "trashed_attachments",
    ]) {
      expect(code).toMatch(new RegExp(`'${key}', v_${key}`));
    }
  });

  it("unioniza las rutas de Storage sin duplicados", () => {
    expect(code).toMatch(/jsonb_agg\(p\.storage_path ORDER BY p\.storage_path\)/);
    expect(code.match(/\bUNION\b(?! ALL)/g)?.length).toBeGreaterThanOrEqual(1);
    expect(code).toMatch(/'storage_paths', v_paths/);
  });

  it("dry_run true o NULL solo cuenta; false borra los hilos de Papelera", () => {
    expect(code).toMatch(/v_dry_run boolean := COALESCE\(dry_run, true\)/);
    expect(code).toMatch(/IF NOT v_dry_run THEN/);
    const trashDelete = /DELETE FROM public\.email_threads[\s\S]*?expired_trash_threads[\s\S]*?;/;
    expect(code).toMatch(trashDelete);
  });

  it("mantiene SECURITY DEFINER y concede EXECUTE solo a service_role", () => {
    expect(code).toMatch(/SECURITY DEFINER/);
    expect(code).toMatch(/SET search_path = public, pg_temp/);
    expect(code).toMatch(
      /REVOKE ALL ON FUNCTION public\.purge_expired_personal_data\(boolean\)\s+FROM PUBLIC, anon, authenticated;/,
    );
    expect(code).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.purge_expired_personal_data\(boolean\)\s+TO service_role;/,
    );
    expect(code.match(/\bGRANT\b/g)?.length).toBe(1);
    expect(code).not.toMatch(/GRANT[\s\S]*?\bTO\s+(?:PUBLIC|anon|authenticated)\b/i);
  });

  it("no modifica la migración antigua de retención", () => {
    const older = readFileSync(path.join(migrationsDir, olderFileName), "utf8");
    expect(older).toMatch(
      /CREATE OR REPLACE FUNCTION public\.purge_expired_personal_data\(dry_run boolean DEFAULT true\)/,
    );
    expect(older).not.toMatch(/trashed_at/);
    expect(older).not.toMatch(/interval '30 days'/);
    expect(older).not.toMatch(/trashed_threads/);
    expect(older).not.toMatch(/trashed_messages/);
    expect(older).not.toMatch(/trashed_attachments/);
  });
});
