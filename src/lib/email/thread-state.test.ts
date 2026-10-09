import { describe, expect, it } from "vitest";
import {
  EMPTY_UNREAD_COUNTS,
  TRASH_RETENTION_DAYS,
  applyThreadPatch,
  formatThreadDate,
  formatUnreadBadge,
  parseThreadView,
  stateToastKey,
  threadDbPatch,
  threadViewOf,
} from "./thread-state";

const NOW = new Date("2026-10-09T15:00:00.000Z");
const STAMP = NOW.toISOString();

describe("parseThreadView", () => {
  it("acepta las tres vistas y cae en inbox con valores raros", () => {
    expect(parseThreadView("inbox")).toBe("inbox");
    expect(parseThreadView(" Archived ")).toBe("archived");
    expect(parseThreadView("trash")).toBe("trash");
    expect(parseThreadView("spam")).toBe("inbox");
    expect(parseThreadView(null)).toBe("inbox");
    expect(parseThreadView(undefined)).toBe("inbox");
  });
});

describe("threadViewOf", () => {
  it("papelera manda sobre archivado", () => {
    expect(threadViewOf({ is_read: false })).toBe("inbox");
    expect(threadViewOf({ is_read: true, archived_at: STAMP })).toBe("archived");
    expect(
      threadViewOf({ is_read: true, archived_at: STAMP, trashed_at: STAMP }),
    ).toBe("trash");
    expect(threadViewOf({ is_read: true, archived_at: null, trashed_at: null })).toBe(
      "inbox",
    );
  });
});

describe("threadDbPatch", () => {
  it("leído/no leído y lead_id pasan tal cual", () => {
    expect(threadDbPatch({ is_read: true }, NOW)).toEqual({ is_read: true });
    expect(threadDbPatch({ is_read: false, lead_id: null }, NOW)).toEqual({
      is_read: false,
      lead_id: null,
    });
  });

  it("archivar pone fecha y saca de la papelera", () => {
    expect(threadDbPatch({ archived: true }, NOW)).toEqual({
      archived_at: STAMP,
      trashed_at: null,
    });
  });

  it("mover a Recibidos limpia archivado y papelera", () => {
    expect(threadDbPatch({ archived: false }, NOW)).toEqual({
      archived_at: null,
      trashed_at: null,
    });
  });

  it("papelera y restaurar no tocan archived_at", () => {
    expect(threadDbPatch({ trashed: true }, NOW)).toEqual({ trashed_at: STAMP });
    expect(threadDbPatch({ trashed: false }, NOW)).toEqual({ trashed_at: null });
  });

  it("trashed explícito gana a archived", () => {
    expect(threadDbPatch({ archived: true, trashed: true }, NOW)).toEqual({
      archived_at: STAMP,
      trashed_at: STAMP,
    });
  });

  it("nunca produce columnas fuera de la lista", () => {
    const db = threadDbPatch(
      { is_read: true, archived: true, trashed: false, lead_id: null },
      NOW,
    );
    expect(Object.keys(db).sort()).toEqual(
      ["archived_at", "is_read", "lead_id", "trashed_at"].sort(),
    );
  });
});

describe("applyThreadPatch", () => {
  const base = { id: "t1", is_read: false, archived_at: null, trashed_at: null };

  it("restaurar desde papelera devuelve el hilo a su vista anterior", () => {
    const archived = applyThreadPatch(base, { archived: true }, NOW);
    expect(threadViewOf(archived)).toBe("archived");
    const trashed = applyThreadPatch(archived, { trashed: true }, NOW);
    expect(threadViewOf(trashed)).toBe("trash");
    const restored = applyThreadPatch(trashed, { trashed: false }, NOW);
    expect(threadViewOf(restored)).toBe("archived");
    expect(restored.id).toBe("t1");
  });

  it("no muta el objeto original", () => {
    const next = applyThreadPatch(base, { is_read: true }, NOW);
    expect(next.is_read).toBe(true);
    expect(base.is_read).toBe(false);
  });
});

describe("formatUnreadBadge", () => {
  it("vacío en 0, número, y 99+", () => {
    expect(formatUnreadBadge(0)).toBe("");
    expect(formatUnreadBadge(-3)).toBe("");
    expect(formatUnreadBadge(Number.NaN)).toBe("");
    expect(formatUnreadBadge(7)).toBe("7");
    expect(formatUnreadBadge(99)).toBe("99");
    expect(formatUnreadBadge(100)).toBe("99+");
  });

  it("contadores vacíos y retención documentada", () => {
    expect(EMPTY_UNREAD_COUNTS).toEqual({ inbox: 0, archived: 0, trash: 0 });
    expect(TRASH_RETENTION_DAYS).toBe(30);
  });
});

describe("formatThreadDate", () => {
  const now = new Date(2026, 9, 9, 18, 30);
  const labels = { yesterday: "Ayer" };

  it("hoy muestra la hora", () => {
    const iso = new Date(2026, 9, 9, 8, 5).toISOString();
    expect(formatThreadDate(iso, "es", labels, now)).toMatch(/08:05/);
  });

  it("ayer por día natural, no por 24 h", () => {
    const iso = new Date(2026, 9, 8, 23, 50).toISOString();
    expect(formatThreadDate(iso, "es", labels, now)).toBe("Ayer");
  });

  it("esta semana muestra el día; este año día y mes; otro año con año", () => {
    const week = new Date(2026, 9, 6, 10, 0).toISOString();
    expect(formatThreadDate(week, "en", labels, now)).toBe("Tue");
    const year = new Date(2026, 2, 3, 10, 0).toISOString();
    expect(formatThreadDate(year, "en", labels, now)).toBe("Mar 3");
    const old = new Date(2025, 11, 24, 10, 0).toISOString();
    expect(formatThreadDate(old, "en", labels, now)).toMatch(/Dec 24, 25/);
  });

  it("fecha inválida devuelve vacío", () => {
    expect(formatThreadDate("nope", "es", labels, now)).toBe("");
  });
});

describe("stateToastKey", () => {
  it("elige el aviso según la acción", () => {
    expect(stateToastKey({ archived: true })).toBe("archivedToast");
    expect(stateToastKey({ archived: false })).toBe("inboxToast");
    expect(stateToastKey({ trashed: true })).toBe("trashedToast");
    expect(stateToastKey({ trashed: false })).toBe("restoredToast");
    expect(stateToastKey({ is_read: true })).toBeNull();
  });
});
