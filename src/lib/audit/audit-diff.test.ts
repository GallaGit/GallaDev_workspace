import { describe, expect, it } from "vitest";
import { buildAuditDiff, leadUpdateAction, leadUpdateDiff } from "./audit-diff";

describe("leadUpdateDiff", () => {
  it("guarda antes→después del estado", () => {
    expect(leadUpdateDiff({ status: "Nuevo" }, { status: "Validado" })).toEqual({
      fields: ["status"],
      changes: { status: { from: "Nuevo", to: "Validado" } },
    });
  });

  it("guarda antes→después de la reasignación", () => {
    expect(
      leadUpdateDiff({ responsibleId: null }, { responsibleId: "u-2" }),
    ).toEqual({
      fields: ["responsibleId"],
      changes: { responsibleId: { from: null, to: "u-2" } },
    });
  });

  it("notas, email, teléfono y mensajes: solo el nombre del campo", () => {
    const diff = leadUpdateDiff(
      { notes: "viejo secreto", email: "a@b.c", phone: "600" },
      {
        notes: "nuevo secreto",
        email: "x@y.z",
        phone: "611",
        emailBody: "hola",
      },
    );
    expect(diff).toEqual({ fields: ["email", "emailBody", "notes", "phone"] });
    expect(JSON.stringify(diff)).not.toMatch(/secreto|@|600|611|hola/);
  });

  it("mezcla campos seguros y sensibles sin filtrar valores sensibles", () => {
    const diff = leadUpdateDiff(
      { status: "Nuevo", notes: "a" },
      { status: "Cliente", notes: "b" },
    );
    expect(Object.keys(diff.changes ?? {})).toEqual(["status"]);
    expect(diff.fields).toEqual(["notes", "status"]);
  });

  it("recorta valores largos", () => {
    const diff = buildAuditDiff(["x"], ["x"], { x: "a" }, { x: "b".repeat(500) });
    expect((diff.changes?.x.to as string).length).toBe(120);
  });
});

describe("leadUpdateAction", () => {
  it("elige una acción por mutación", () => {
    expect(leadUpdateAction({ status: "Cliente", notes: "x" })).toBe("lead.status_changed");
    expect(leadUpdateAction({ responsibleId: "u" })).toBe("lead.reassigned");
    expect(leadUpdateAction({ notes: "x" })).toBe("lead.note_edited");
    expect(leadUpdateAction({ city: "Valencia" })).toBe("lead.updated");
  });
});
