import { describe, expect, it } from "vitest";
import { mergeThreadPage } from "./thread-list-merge";

const t = (id: string, at: string) => ({ id, last_message_at: at });

describe("mergeThreadPage", () => {
  it("una página corta ya es la lista completa", () => {
    const prev = [t("a", "2026-10-02T10:00:00Z"), t("b", "2026-10-01T10:00:00Z")];
    expect(mergeThreadPage(prev, [t("c", "2026-10-03T10:00:00Z")], 3)).toEqual([
      t("c", "2026-10-03T10:00:00Z"),
    ]);
  });

  it("con página llena, pone lo nuevo arriba y conserva las páginas ya cargadas", () => {
    const prev = [
      t("a", "2026-10-05T10:00:00Z"),
      t("b", "2026-10-04T10:00:00Z"),
      t("old1", "2026-10-02T10:00:00Z"),
    ];
    const fresh = [t("n", "2026-10-06T10:00:00Z"), t("a", "2026-10-05T10:00:00Z")];
    expect(mergeThreadPage(prev, fresh, 2).map((x) => x.id)).toEqual(["n", "a", "b", "old1"]);
  });

  it("descarta lo que estaba en la primera página y ya no está (salió de la vista)", () => {
    const prev = [t("a", "2026-10-05T10:00:00Z"), t("gone", "2026-10-04T10:00:00Z")];
    const fresh = [t("a", "2026-10-05T10:00:00Z"), t("c", "2026-10-03T10:00:00Z")];
    expect(mergeThreadPage(prev, fresh, 2).map((x) => x.id)).toEqual(["a", "c"]);
  });
});
