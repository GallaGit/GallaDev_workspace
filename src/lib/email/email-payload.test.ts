import { describe, expect, it } from "vitest";
import { MAX_EMAIL_BODY_CHARS, MAX_EMAIL_SUBJECT_CHARS } from "./limits";
import {
  parseComposeBody,
  parseDraftBody,
  parseReplyBody,
  parseThreadBulkPatch,
  parseThreadPatch,
  MAX_BULK_THREAD_IDS,
} from "./email-payload";

const LEAD = "11111111-1111-4111-8111-111111111111";

describe("parseComposeBody", () => {
  it("acepta buzón de la lista, UUID y cuerpo", () => {
    const parsed = parseComposeBody({
      mailbox: "Ociel@galladev.com",
      to: "Cliente <ana@example.com>",
      subject: "Hola",
      text: "Cuerpo",
      draftId: LEAD,
      leadId: LEAD,
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.mailbox).toBe("ociel@galladev.com");
      expect(parsed.value.to).toBe("Cliente <ana@example.com>");
      expect(parsed.value.draftId).toBe(LEAD);
    }
  });

  it("rechaza buzón ajeno, UUID mal formado y cuerpo enorme", () => {
    expect(parseComposeBody({ mailbox: "otro@galladev.com", to: "a@b.com", text: "x" }).ok).toBe(
      false,
    );
    expect(
      parseComposeBody({
        mailbox: "hola@galladev.com",
        to: "a@b.com",
        text: "x",
        leadId: "no-es-uuid",
      }).ok,
    ).toBe(false);
    const huge = parseComposeBody({
      mailbox: "hola@galladev.com",
      to: "a@b.com",
      text: "a".repeat(MAX_EMAIL_BODY_CHARS + 1),
    });
    expect(huge).toMatchObject({ ok: false, error: "El cuerpo es demasiado largo" });
    const subject = parseComposeBody({
      mailbox: "hola@galladev.com",
      to: "a@b.com",
      text: "x",
      subject: "s".repeat(MAX_EMAIL_SUBJECT_CHARS + 1),
    });
    expect(subject.ok).toBe(false);
  });
});

describe("parseReplyBody", () => {
  it("exige texto y topa el HTML", () => {
    expect(parseReplyBody({ text: "  " })).toMatchObject({
      ok: false,
      error: "El texto de la respuesta no puede estar vacío",
    });
    expect(
      parseReplyBody({ text: "hola", html: "h".repeat(MAX_EMAIL_BODY_CHARS + 1) }).ok,
    ).toBe(false);
    expect(parseReplyBody({ text: "hola", extra: 1 }).ok).toBe(false);
  });
});

describe("parseDraftBody", () => {
  it("usa hola@ si no hay buzón y permite un destinatario a medias", () => {
    const parsed = parseDraftBody({ to: "ana", subject: "Borrador", bodyText: "" });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.mailbox).toBe("hola@galladev.com");
      expect(parsed.value.to).toBe("ana");
      expect(parsed.value.leadId).toBeNull();
    }
  });

  it("rechaza un buzón fuera de la lista y un id que no es UUID", () => {
    expect(parseDraftBody({ mailbox: "otro@galladev.com", bodyText: "x" })).toMatchObject({
      ok: false,
      error: "Buzón de origen no válido",
    });
    expect(parseDraftBody({ id: "draft-1", bodyText: "x" }).ok).toBe(false);
  });
});

describe("parseThreadPatch", () => {
  it("acepta leído y lead nulo, y rechaza un lead mal formado", () => {
    expect(parseThreadPatch({ is_read: true })).toEqual({
      ok: true,
      patch: { is_read: true },
    });
    expect(parseThreadPatch({ lead_id: null })).toEqual({
      ok: true,
      patch: { lead_id: null },
    });
    expect(parseThreadPatch({ lead_id: "page-id" })).toMatchObject({
      ok: false,
      error: "lead_id no es un UUID",
    });
    expect(parseThreadPatch({})).toMatchObject({ ok: false, error: "Nada que actualizar" });
    expect(parseThreadPatch({ is_read: true, foo: 1 }).ok).toBe(false);
  });
});

describe("parseThreadPatch: archivar y papelera", () => {
  it("acepta archived y trashed booleanos", () => {
    expect(parseThreadPatch({ archived: true })).toEqual({
      ok: true,
      patch: { archived: true },
    });
    expect(parseThreadPatch({ trashed: false, is_read: false })).toEqual({
      ok: true,
      patch: { trashed: false, is_read: false },
    });
  });

  it("rechaza tipos que no son booleanos y fechas puestas a mano", () => {
    expect(parseThreadPatch({ archived: "yes" }).ok).toBe(false);
    expect(parseThreadPatch({ trashed: 1 }).ok).toBe(false);
    expect(parseThreadPatch({ trashed_at: "2026-01-01" })).toMatchObject({
      ok: false,
      error: "Campo no permitido",
    });
  });
});

describe("parseThreadBulkPatch", () => {
  const A = "ed07cdd4-c542-4f9a-8b8e-bd73e358c6cd";
  const B = "22222222-2222-4222-8222-222222222222";

  it("acepta ids UUID y deduplica", () => {
    expect(
      parseThreadBulkPatch({ ids: [A, B, A.toUpperCase()], is_read: true }),
    ).toEqual({ ok: true, value: { ids: [A, B], patch: { is_read: true } } });
  });

  it("acepta archived y trashed", () => {
    expect(parseThreadBulkPatch({ ids: [A], archived: true, trashed: false })).toEqual({
      ok: true,
      value: { ids: [A], patch: { archived: true, trashed: false } },
    });
  });

  it("rechaza lista vacía, ids no UUID, demasiados y sin acción", () => {
    expect(parseThreadBulkPatch({ ids: [], is_read: true })).toMatchObject({
      ok: false,
      error: "Selecciona al menos un hilo",
    });
    expect(parseThreadBulkPatch({ ids: ["1 OR 1=1"], is_read: true })).toMatchObject({
      ok: false,
      error: "Identificador no válido",
    });
    const many = Array.from({ length: MAX_BULK_THREAD_IDS + 1 }, () => A);
    expect(parseThreadBulkPatch({ ids: many, is_read: true })).toMatchObject({
      ok: false,
      error: "Demasiados hilos a la vez",
    });
    expect(parseThreadBulkPatch({ ids: [A] })).toMatchObject({
      ok: false,
      error: "Nada que actualizar",
    });
  });

  it("no deja tocar lead_id ni campos extra en bloque", () => {
    expect(parseThreadBulkPatch({ ids: [A], lead_id: null }).ok).toBe(false);
    expect(parseThreadBulkPatch({ ids: [A], is_read: true, subject: "x" }).ok).toBe(
      false,
    );
    expect(parseThreadBulkPatch(null).ok).toBe(false);
    expect(parseThreadBulkPatch([A]).ok).toBe(false);
  });
});
