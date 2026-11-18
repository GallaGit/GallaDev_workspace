import { describe, expect, it } from "vitest";
import {
  THREAD_LIST_COLUMNS,
  applyThreadViewFilter,
  stripMessageEmbed,
  threadCountSelect,
  threadListSelect,
} from "./thread-view-query";

type Call = { method: string; args: unknown[] };

function chain() {
  const calls: Call[] = [];
  const query: Record<string, unknown> = {};
  for (const method of ["is", "not", "eq"] as const) {
    query[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return query;
    };
  }
  return { query: query as never, calls };
}

describe("thread list/count select", () => {
  it("Enviados añade el inner join; el resto no", () => {
    expect(threadListSelect("sent", "view")).toBe(
      `${THREAD_LIST_COLUMNS}, email_messages!inner(id)`,
    );
    expect(threadListSelect("sent", "all")).toBe(THREAD_LIST_COLUMNS);
    expect(threadListSelect("inbox", "view")).toBe(THREAD_LIST_COLUMNS);
    expect(threadCountSelect("sent")).toBe("id, email_messages!inner(id)");
    expect(threadCountSelect("trash")).toBe("id");
  });
});

describe("applyThreadViewFilter", () => {
  it("Enviados: outbound y fuera de Papelera, sin filtrar archivados", () => {
    const { query, calls } = chain();
    applyThreadViewFilter(query, "sent");
    expect(calls).toEqual([
      { method: "eq", args: ["email_messages.direction", "outbound"] },
      { method: "is", args: ["trashed_at", null] },
    ]);
  });

  it("Recibidos, Archivados y Papelera como hasta ahora", () => {
    const inbox = chain();
    applyThreadViewFilter(inbox.query, "inbox");
    expect(inbox.calls).toEqual([
      { method: "is", args: ["trashed_at", null] },
      { method: "is", args: ["archived_at", null] },
    ]);
    const archived = chain();
    applyThreadViewFilter(archived.query, "archived");
    expect(archived.calls).toEqual([
      { method: "is", args: ["trashed_at", null] },
      { method: "not", args: ["archived_at", "is", null] },
    ]);
    const trash = chain();
    applyThreadViewFilter(trash.query, "trash");
    expect(trash.calls).toEqual([
      { method: "not", args: ["trashed_at", "is", null] },
    ]);
  });
});

describe("stripMessageEmbed", () => {
  it("elimina el embed y admite filas vacías", () => {
    expect(
      stripMessageEmbed([
        { id: "t1", subject: "Hola", email_messages: [{ id: "m1" }] },
      ]),
    ).toEqual([{ id: "t1", subject: "Hola" }]);
    expect(stripMessageEmbed(null)).toEqual([]);
  });
});
