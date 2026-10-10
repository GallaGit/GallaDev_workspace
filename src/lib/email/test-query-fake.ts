/**
 * Fake mínimo y encadenable del query builder de Supabase para tests.
 * `resolve(table, op, filters)` devuelve { data, error?, count? }.
 */
export type FakeCall = {
  table: string;
  op: "select" | "update" | "delete" | "insert";
  payload?: unknown;
  filters: [string, ...unknown[]][];
  head?: boolean;
};

type Resolver = (call: FakeCall) => { data?: unknown; error?: unknown; count?: number };

export function fakeSupabase(resolve: Resolver) {
  const calls: FakeCall[] = [];
  function builder(call: FakeCall) {
    const b: Record<string, unknown> = {};
    const chain = (name: string) => (...args: unknown[]) => {
      call.filters.push([name, ...args]);
      return b;
    };
    for (const n of ["eq", "in", "or", "gte", "lte", "like", "is", "order", "limit"]) {
      b[n] = chain(n);
    }
    const done = () => Promise.resolve(resolve(call));
    b.select = () => b;
    b.single = done;
    b.maybeSingle = done;
    b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
      done().then(ok, ko);
    return b;
  }
  const client = {
    from(table: string) {
      return {
        select: (_cols?: string, opts?: { head?: boolean }) => {
          const call: FakeCall = { table, op: "select", filters: [], head: opts?.head };
          calls.push(call);
          return builder(call);
        },
        update: (payload: unknown) => {
          const call: FakeCall = { table, op: "update", payload, filters: [] };
          calls.push(call);
          return builder(call);
        },
        delete: () => {
          const call: FakeCall = { table, op: "delete", filters: [] };
          calls.push(call);
          return builder(call);
        },
        insert: (payload: unknown) => {
          const call: FakeCall = { table, op: "insert", payload, filters: [] };
          calls.push(call);
          return builder(call);
        },
      };
    },
  };
  return { client, calls };
}

export function filterValue(call: FakeCall, name: string, col?: string): unknown {
  const f = call.filters.find((x) => x[0] === name && (col === undefined || x[1] === col));
  return f ? (col === undefined ? f[1] : f[2]) : undefined;
}
