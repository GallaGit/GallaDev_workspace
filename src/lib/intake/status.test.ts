/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { resolveIntakeStatus, shouldAutoOpen } from "./status";
import { formatReopensAtForDisplay, substituteFechaPlaceholder } from "./format-fecha";

const NOW = new Date("2026-09-18T12:00:00.000Z");

describe("resolveIntakeStatus", () => {
  it("abierto → { open: true }", () => {
    expect(
      resolveIntakeStatus(
        { isOpen: true, message: "x", reopensAt: "2026-10-01T00:00:00.000Z" },
        NOW,
      ),
    ).toEqual({ open: true });
  });

  it("pausado con reopensAt futuro → cerrado + mensaje + reopensAt", () => {
    const status = resolveIntakeStatus(
      {
        isOpen: false,
        message: "Volvemos el {fecha}.",
        reopensAt: "2026-09-20T10:00:00.000Z",
      },
      NOW,
    );
    expect(status.open).toBe(false);
    if (status.open) throw new Error("expected closed");
    expect(status.reopensAt).toBe("2026-09-20T10:00:00.000Z");
    expect(status.message).toContain("Volvemos el ");
    expect(status.message).not.toContain("{fecha}");
  });

  it("pausado con reopensAt pasado → auto-abierto", () => {
    expect(
      resolveIntakeStatus(
        {
          isOpen: false,
          message: "Volvemos el {fecha}.",
          reopensAt: "2026-09-17T10:00:00.000Z",
        },
        NOW,
      ),
    ).toEqual({ open: true });
  });

  it("pausado sin reopensAt → cerrado (sin auto-open)", () => {
    const status = resolveIntakeStatus(
      { isOpen: false, message: "Pausa indefinida", reopensAt: null },
      NOW,
    );
    expect(status).toEqual({
      open: false,
      message: "Pausa indefinida",
      reopensAt: null,
    });
  });

  it("pausado con reopensAt inválido → cerrado", () => {
    const status = resolveIntakeStatus(
      { isOpen: false, message: "msg", reopensAt: "not-a-date" },
      NOW,
    );
    expect(status.open).toBe(false);
  });
});

describe("shouldAutoOpen", () => {
  it("false si ya abierto", () => {
    expect(
      shouldAutoOpen({ isOpen: true, reopensAt: "2020-01-01T00:00:00.000Z" }, NOW),
    ).toBe(false);
  });

  it("false sin fecha o fecha futura", () => {
    expect(shouldAutoOpen({ isOpen: false, reopensAt: null }, NOW)).toBe(false);
    expect(
      shouldAutoOpen(
        { isOpen: false, reopensAt: "2026-12-01T00:00:00.000Z" },
        NOW,
      ),
    ).toBe(false);
  });

  it("true si cerrado y reopensAt pasado", () => {
    expect(
      shouldAutoOpen(
        { isOpen: false, reopensAt: "2026-09-01T00:00:00.000Z" },
        NOW,
      ),
    ).toBe(true);
  });
});

describe("substituteFechaPlaceholder", () => {
  it("sustituye {fecha} case-insensitive", () => {
    const out = substituteFechaPlaceholder(
      "Hasta {FECHA} / {fecha}",
      "2026-09-20T10:00:00.000Z",
    );
    expect(out).not.toMatch(/\{fecha\}/i);
    expect(out.startsWith("Hasta ")).toBe(true);
  });

  it("sin fecha deja vacío el placeholder", () => {
    expect(substituteFechaPlaceholder("Hasta {fecha}.", null)).toBe(
      "Hasta .",
    );
  });
});

describe("formatReopensAtForDisplay", () => {
  it("devuelve string no vacío para ISO válido", () => {
    const s = formatReopensAtForDisplay("2026-09-20T10:00:00.000Z");
    expect(s.length).toBeGreaterThan(5);
  });

  it("vacío si null o inválido", () => {
    expect(formatReopensAtForDisplay(null)).toBe("");
    expect(formatReopensAtForDisplay("nope")).toBe("");
  });
});
