import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261128120000_audit_log_hardening.sql"),
  "utf8",
);

describe("migración audit_log_hardening", () => {
  it("elimina la policy de insert y revoca INSERT/UPDATE/DELETE a authenticated", () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS "audit_log_insert"/);
    expect(sql).toMatch(
      /REVOKE INSERT, UPDATE, DELETE[^;]*ON public\.audit_log FROM authenticated;/,
    );
    expect(sql).toMatch(/REVOKE ALL ON public\.audit_log FROM anon;/);
  });

  it("no concede escritura a authenticated ni a anon", () => {
    const grants = sql.match(/GRANT [^;]+;/g) ?? [];
    for (const grant of grants) {
      if (/TO (authenticated|anon)\b/.test(grant)) {
        expect(grant).toBe("GRANT SELECT ON public.audit_log TO authenticated;");
      }
    }
    expect(sql).not.toMatch(/CREATE POLICY[^;]*FOR (INSERT|UPDATE|DELETE|ALL)/);
  });

  it("append-only también para service_role", () => {
    expect(sql).toMatch(/REVOKE UPDATE, DELETE, TRUNCATE ON public\.audit_log FROM service_role;/);
  });

  it("lectura: Admin todo; Seller y Viewer solo leads visibles", () => {
    expect(sql).toMatch(/current_app_role\(\) = 'Admin'/);
    expect(sql).toMatch(/current_app_role\(\) IN \('Seller', 'Viewer'\)/);
    expect(sql).toMatch(/EXISTS \(SELECT 1 FROM public\.leads l WHERE l\.id = audit_log\.lead_id\)/);
  });
});
