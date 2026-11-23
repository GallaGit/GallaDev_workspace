import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
const fileName = "20261123200000_email_correo_seller_access.sql";

describe("migración Correo Admin+Seller", () => {
  const sql = readFileSync(path.join(migrationsDir, fileName), "utf8");

  it("abre hilos, mensajes, adjuntos y borradores a Admin y Seller", () => {
    expect(sql).toMatch(/email_threads_mailbox_read/);
    expect(sql).toMatch(/email_threads_mailbox_update/);
    expect(sql).toMatch(/email_messages_mailbox_read/);
    expect(sql).toMatch(/email_attachments_mailbox_read/);
    expect(sql).toMatch(/email_drafts_mailbox_select/);
    expect(sql).toMatch(/email_drafts_mailbox_insert/);
    expect(sql).toMatch(/email_drafts_mailbox_update/);
    expect(sql).toMatch(/email_drafts_mailbox_delete/);
    expect(sql).toMatch(/current_app_role\(\) IN \('Admin', 'Seller'\)/);
    expect(sql).toMatch(/idx_email_drafts_lead_new/);
  });

  it("permite leer firmas a Admin y Seller, sin cambiar la escritura Admin", () => {
    expect(sql).toMatch(/email_mailbox_signatures_mailbox_select/);
    expect(sql).toMatch(/current_app_role\(\) IN \('Admin', 'Seller'\)/);
    expect(sql).not.toMatch(/email_mailbox_signatures_admin_insert/);
    expect(sql).not.toMatch(/email_mailbox_signatures_admin_update/);
  });

  it("es un archivo nuevo, no reescribe migraciones anteriores", () => {
    const names = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));
    expect(names.filter((name) => name === fileName)).toHaveLength(1);
    expect(names.some((name) => name < fileName)).toBe(true);
  });
});
