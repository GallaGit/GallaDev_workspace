import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchReceivingEmail = vi.hoisted(() => vi.fn());

vi.mock("./receiving-fetch", () => ({
  fetchReceivingEmail,
}));

vi.mock("./sanitize-email-html", () => ({
  prepareStoredEmailBodies: (html?: string | null, text?: string | null) => ({
    html: html ?? null,
    text: text ?? null,
  }),
}));

import { backfillMissingBodies } from "./backfill-bodies";

function mockAdmin(opts: {
  rows?: Array<Record<string, unknown>>;
  listError?: { message: string } | null;
  currentById?: Record<
    string,
    { id: string; body_html: string | null; body_text: string | null }
  >;
  updateError?: { message: string } | null;
} = {}) {
  const rows = opts.rows ?? [];
  const currentById = opts.currentById ?? {};
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];

  return {
    updates,
    from: vi.fn().mockImplementation((table: string) => {
      if (table !== "email_messages") return {};
      return {
        select: vi.fn().mockImplementation(() => {
          const listChain = {
            eq: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: opts.listError ? null : rows,
              error: opts.listError ?? null,
            }),
            maybeSingle: vi.fn().mockImplementation(async function (
              this: { _id?: string },
            ) {
              const id = this._id;
              if (!id) return { data: null, error: null };
              return {
                data: currentById[id] ?? {
                  id,
                  body_html: null,
                  body_text: null,
                },
                error: null,
              };
            }),
          };
          // When re-checking a single row: select().eq().maybeSingle()
          const eqForSingle = vi.fn().mockImplementation((col: string, val: string) => {
            if (col === "id") {
              return {
                maybeSingle: async () => ({
                  data: currentById[val] ?? {
                    id: val,
                    body_html: null,
                    body_text: null,
                  },
                  error: null,
                }),
                is: vi.fn().mockReturnValue({
                  is: vi.fn().mockResolvedValue({
                    error: opts.updateError ?? null,
                  }),
                }),
              };
            }
            return listChain;
          });
          return {
            ...listChain,
            eq: eqForSingle,
          };
        }),
        update: vi.fn().mockImplementation((patch: Record<string, unknown>) => {
          return {
            eq: vi.fn().mockImplementation((_col: string, id: string) => {
              updates.push({ id, patch });
              return {
                is: vi.fn().mockReturnValue({
                  is: vi.fn().mockResolvedValue({
                    error: opts.updateError ?? null,
                  }),
                }),
              };
            }),
          };
        }),
      };
    }),
  } as unknown as Parameters<typeof backfillMissingBodies>[0] & {
    updates: Array<{ id: string; patch: Record<string, unknown> }>;
  };
}

describe("backfillMissingBodies", () => {
  beforeEach(() => {
    fetchReceivingEmail.mockReset();
  });

  it("updates empty inbound messages from Receiving API", async () => {
    fetchReceivingEmail.mockResolvedValue({
      ok: true,
      data: {
        html: "<p>Recovered</p>",
        text: "Recovered",
        headers: null,
        messageId: "<m@x.com>",
        attachments: [],
      },
    });

    const admin = mockAdmin({
      rows: [{ id: "m1", resend_email_id: "em_1", body_html: null, body_text: null }],
    });

    const result = await backfillMissingBodies(admin, { limit: 10 });
    expect(result).toEqual({
      scanned: 1,
      updated: 1,
      skipped: 0,
      failed: 0,
    });
    expect(fetchReceivingEmail).toHaveBeenCalledWith("em_1");
    expect(admin.updates).toEqual([
      {
        id: "m1",
        patch: { body_html: "<p>Recovered</p>", body_text: "Recovered" },
      },
    ]);
  });

  it("counts failed when Receiving API still returns error", async () => {
    fetchReceivingEmail.mockResolvedValue({
      ok: false,
      status: 401,
      errorName: "validation_error",
    });

    const admin = mockAdmin({
      rows: [{ id: "m1", resend_email_id: "em_1", body_html: null, body_text: null }],
    });

    const result = await backfillMissingBodies(admin);
    expect(result).toEqual({
      scanned: 1,
      updated: 0,
      skipped: 0,
      failed: 1,
    });
    expect(admin.updates).toHaveLength(0);
  });

  it("skips when another run already filled the body", async () => {
    fetchReceivingEmail.mockResolvedValue({
      ok: true,
      data: {
        html: "<p>x</p>",
        text: "x",
        headers: null,
        messageId: null,
        attachments: [],
      },
    });

    const admin = mockAdmin({
      rows: [{ id: "m1", resend_email_id: "em_1", body_html: null, body_text: null }],
      currentById: {
        m1: { id: "m1", body_html: "<p>already</p>", body_text: "already" },
      },
    });

    const result = await backfillMissingBodies(admin);
    expect(result.skipped).toBe(1);
    expect(result.updated).toBe(0);
    expect(admin.updates).toHaveLength(0);
  });

  it("is idempotent on empty candidate list", async () => {
    const admin = mockAdmin({ rows: [] });
    const result = await backfillMissingBodies(admin);
    expect(result).toEqual({
      scanned: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    });
    expect(fetchReceivingEmail).not.toHaveBeenCalled();
  });
});
