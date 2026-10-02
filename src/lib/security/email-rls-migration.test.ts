import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
const fileName = "20261002190000_email_rls_and_force.sql";

describe("migración SEC-012", () => {
  const sql = readFileSync(path.join(migrationsDir, fileName), "utf8");

  it("repite Admin en mensajes y adjuntos y fuerza RLS", () => {
    expect(sql).toMatch(/email_messages_admin_read/);
    expect(sql).toMatch(/email_attachments_admin_read/);
    const messages = sql.slice(sql.indexOf("email_messages_admin_read"));
    expect(messages).toMatch(/current_app_role\(\) = 'Admin'/);
    expect(sql).toMatch(/ALTER TABLE public\.leads FORCE ROW LEVEL SECURITY/);
    expect(sql).toMatch(
      /ALTER TABLE public\.email_messages FORCE ROW LEVEL SECURITY/,
    );
    expect(sql).toMatch(
      /ALTER TABLE public\.email_attachments FORCE ROW LEVEL SECURITY/,
    );
    expect(sql).toMatch(
      /ALTER TABLE public\.email_drafts FORCE ROW LEVEL SECURITY/,
    );
  });

  it("es un archivo nuevo, no reescribe migraciones anteriores", () => {
    const names = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));
    expect(names.filter((name) => name === fileName)).toHaveLength(1);
    expect(names.some((name) => name < fileName)).toBe(true);
  });
});
