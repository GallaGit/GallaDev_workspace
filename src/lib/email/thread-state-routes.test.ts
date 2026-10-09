import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdmin = vi.hoisted(() =>
  vi.fn(async (): Promise<Response | null> => null),
);
const createSupabaseServerClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({ requireAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));
vi.mock("@/lib/email/sanitize-email-html", () => ({
  prepareEmailHtml: (value: string | null) => value,
  capEmailText: (value: string | null) => value,
}));

const A = "ed07cdd4-c542-4f9a-8b8e-bd73e358c6cd";
const B = "22222222-2222-4222-8222-222222222222";

type Call = { method: string; args: unknown[] };

/** Cliente falso encadenable que registra cada llamada del query builder. */
function fakeClient(result: Record<string, unknown>) {
  const calls: Call[] = [];
  const tables: string[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of [
    "select",
    "update",
    "eq",
    "in",
    "is",
    "not",
    "order",
    "range",
    "single",
    "textSearch",
    "limit",
  ]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.then = (resolve: (v: unknown) => unknown) => resolve(result);
  const client = {
    from: (table: string) => {
      tables.push(table);
      return builder;
    },
  };
  return { client, calls, tables };
}

function patchRequest(body: unknown): Request {
  return new Request("http://localhost/api/email/threads", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue(null);
});

describe("PATCH /api/email/threads (masivo)", () => {
  it("sin Admin devuelve la denegación y no abre Supabase", async () => {
    requireAdmin.mockResolvedValue(
      new Response(JSON.stringify({ ok: false }), { status: 403 }),
    );
    const { PATCH } = await import("@/app/api/email/threads/route");
    const res = await PATCH(patchRequest({ ids: [A], archived: true }));
    expect(res.status).toBe(403);
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("400 con ids no válidos, sin tocar la BD", async () => {
    const { PATCH } = await import("@/app/api/email/threads/route");
    const res = await PATCH(patchRequest({ ids: ["x"], is_read: true }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "Identificador no válido" });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("actualiza solo las columnas de estado y solo los ids pedidos", async () => {
    const fake = fakeClient({ data: [{ id: A }], error: null });
    createSupabaseServerClient.mockResolvedValue(fake.client);
    const { PATCH } = await import("@/app/api/email/threads/route");
    const res = await PATCH(patchRequest({ ids: [A, B], archived: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, updated: [A] });
    expect(fake.tables).toEqual(["email_threads"]);

    const update = fake.calls.find((c) => c.method === "update");
    const patch = update?.args[0] as Record<string, unknown>;
    expect(Object.keys(patch).sort()).toEqual(["archived_at", "trashed_at"]);
    expect(typeof patch.archived_at).toBe("string");
    expect(patch.trashed_at).toBeNull();
    expect(fake.calls.find((c) => c.method === "in")?.args).toEqual(["id", [A, B]]);
  });

  it("error de Supabase responde 500 sin filtrar el mensaje", async () => {
    const fake = fakeClient({
      data: null,
      error: { code: "42703", message: 'column "archived_at" does not exist' },
    });
    createSupabaseServerClient.mockResolvedValue(fake.client);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { PATCH } = await import("@/app/api/email/threads/route");
    const res = await PATCH(patchRequest({ ids: [A], trashed: true }));
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("archived_at");
    spy.mockRestore();
  });
});

describe("PATCH /api/email/threads/[id]", () => {
  it("traduce archived/trashed a columnas con fecha", async () => {
    const fake = fakeClient({ data: { id: A }, error: null });
    createSupabaseServerClient.mockResolvedValue(fake.client);
    const { PATCH } = await import("@/app/api/email/threads/[id]/route");
    const res = await PATCH(
      new Request(`http://localhost/api/email/threads/${A}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trashed: true, is_read: true }),
      }),
      { params: Promise.resolve({ id: A }) },
    );
    expect(res.status).toBe(200);
    const patch = fake.calls.find((c) => c.method === "update")?.args[0] as Record<
      string,
      unknown
    >;
    expect(patch.is_read).toBe(true);
    expect(typeof patch.trashed_at).toBe("string");
    expect(patch).not.toHaveProperty("archived_at");
    expect(patch).not.toHaveProperty("trashed");
    expect(fake.calls.find((c) => c.method === "eq")?.args).toEqual(["id", A]);
  });
});

describe("GET /api/email/threads?view=", () => {
  async function filtersFor(query: string) {
    const fake = fakeClient({ data: [], error: null });
    createSupabaseServerClient.mockResolvedValue(fake.client);
    const { GET } = await import("@/app/api/email/threads/route");
    const res = await GET(new Request(`http://localhost/api/email/threads${query}`));
    expect(res.status).toBe(200);
    return {
      body: await res.json(),
      filters: fake.calls
        .filter((c) => c.method === "is" || c.method === "not" || c.method === "eq")
        .map((c) => [c.method, ...c.args]),
      select: fake.calls.find((c) => c.method === "select")?.args[0] as string,
    };
  }

  it("Recibidos por defecto: sin archivar ni papelera", async () => {
    const { body, filters, select } = await filtersFor("");
    expect(body.view).toBe("inbox");
    expect(filters).toEqual([
      ["is", "trashed_at", null],
      ["is", "archived_at", null],
    ]);
    expect(select).toContain("last_snippet");
    expect(select).toContain("has_attachments");
  });

  it("Archivados y Papelera, con filtro de buzón de la allowlist", async () => {
    expect((await filtersFor("?view=archived")).filters).toEqual([
      ["is", "trashed_at", null],
      ["not", "archived_at", "is", null],
    ]);
    expect((await filtersFor("?view=trash&mailbox=ociel@galladev.com")).filters).toEqual([
      ["not", "trashed_at", "is", null],
      ["eq", "mailbox_address", "ociel@galladev.com"],
    ]);
    expect((await filtersFor("?mailbox=otro@example.com")).filters).toEqual([
      ["is", "trashed_at", null],
      ["is", "archived_at", null],
    ]);
  });
});

describe("GET /api/email/threads/unread-count", () => {
  it("cuenta no leídos por vista con HEAD", async () => {
    const fake = fakeClient({ count: 3, error: null });
    createSupabaseServerClient.mockResolvedValue(fake.client);
    const { GET } = await import("@/app/api/email/threads/unread-count/route");
    const res = await GET(new Request("http://localhost/api/email/threads/unread-count"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      counts: { inbox: 3, archived: 3, trash: 3 },
    });
    const selects = fake.calls.filter((c) => c.method === "select");
    expect(selects).toHaveLength(3);
    for (const s of selects) {
      expect(s.args[1]).toEqual({ count: "exact", head: true });
    }
    const readFilters = fake.calls.filter(
      (c) => c.method === "eq" && c.args[0] === "is_read",
    );
    expect(readFilters).toHaveLength(3);
    expect(readFilters.every((c) => c.args[1] === false)).toBe(true);
  });

  it("sin Admin no abre Supabase", async () => {
    requireAdmin.mockResolvedValue(new Response(null, { status: 401 }));
    const { GET } = await import("@/app/api/email/threads/unread-count/route");
    const res = await GET(new Request("http://localhost/api/email/threads/unread-count"));
    expect(res.status).toBe(401);
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("error de Supabase → 500 genérico", async () => {
    const fake = fakeClient({ count: null, error: { code: "42703" } });
    createSupabaseServerClient.mockResolvedValue(fake.client);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { GET } = await import("@/app/api/email/threads/unread-count/route");
    const res = await GET(new Request("http://localhost/api/email/threads/unread-count"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      ok: false,
      error: "No se pudieron contar los no leídos",
    });
    spy.mockRestore();
  });
});

describe("GET /api/email/threads?q= (búsqueda)", () => {
  async function run(query: string, result: Record<string, unknown>) {
    const fake = fakeClient(result);
    createSupabaseServerClient.mockResolvedValue(fake.client);
    const { GET } = await import("@/app/api/email/threads/route");
    const res = await GET(new Request(`http://localhost/api/email/threads${query}`));
    return { res, fake };
  }

  it("busca en hilos y mensajes con tsquery seguro y filtra por ids", async () => {
    const { res, fake } = await run(
      "?q=" + encodeURIComponent("ana presupuesto | !x"),
      { data: [{ id: A, thread_id: B }], error: null },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, view: "inbox", scope: "view", q: "ana presupuesto | !x" });
    expect(fake.tables).toEqual(["email_threads", "email_messages", "email_threads"]);
    const searches = fake.calls.filter((c) => c.method === "textSearch");
    expect(searches).toHaveLength(2);
    for (const call of searches) {
      expect(call.args).toEqual([
        "search_tsv",
        "ana:* & presupuesto:* & x:*",
        { config: "spanish" },
      ]);
    }
    expect(fake.calls.find((c) => c.method === "in")?.args).toEqual(["id", [A, B]]);
    // Sigue filtrando por la vista actual.
    expect(fake.calls.some((c) => c.method === "is" && c.args[0] === "archived_at")).toBe(true);
  });

  it("scope=all quita el filtro de vista", async () => {
    const { res, fake } = await run("?q=ana&scope=all&view=trash", {
      data: [{ id: A, thread_id: A }],
      error: null,
    });
    expect(res.status).toBe(200);
    expect((await res.json()).scope).toBe("all");
    expect(
      fake.calls.some(
        (c) =>
          (c.method === "is" || c.method === "not") &&
          (c.args[0] === "archived_at" || c.args[0] === "trashed_at"),
      ),
    ).toBe(false);
  });

  it("sin coincidencias devuelve lista vacía sin consultar la lista", async () => {
    const { res, fake } = await run("?q=nada", { data: [], error: null });
    expect(await res.json()).toMatchObject({ ok: true, threads: [] });
    expect(fake.tables).toEqual(["email_threads", "email_messages"]);
  });

  it("solo símbolos: vacío sin tocar la BD", async () => {
    const { res, fake } = await run("?q=" + encodeURIComponent("!!! ()"), {
      data: [],
      error: null,
    });
    expect(await res.json()).toMatchObject({ ok: true, threads: [] });
    expect(fake.tables).toEqual([]);
  });

  it("q demasiado larga → 400 sin consultar", async () => {
    const { GET } = await import("@/app/api/email/threads/route");
    const res = await GET(
      new Request(`http://localhost/api/email/threads?q=${"a".repeat(201)}`),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "La búsqueda es demasiado larga" });
  });

  it("error de FTS → 500 genérico", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { res } = await run("?q=ana", {
      data: null,
      error: { code: "42703", message: 'column "search_tsv" does not exist' },
    });
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain("search_tsv");
    expect(JSON.parse(text)).toEqual({ ok: false, error: "No se pudo buscar en el correo" });
    spy.mockRestore();
  });

  it("sin Admin no busca", async () => {
    requireAdmin.mockResolvedValue(new Response(null, { status: 403 }));
    const { GET } = await import("@/app/api/email/threads/route");
    const res = await GET(new Request("http://localhost/api/email/threads?q=ana"));
    expect(res.status).toBe(403);
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });
});
