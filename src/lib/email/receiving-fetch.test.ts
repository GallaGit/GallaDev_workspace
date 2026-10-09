import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.fn();
const logRouteError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/route-log", () => ({
  logRouteError,
}));

vi.mock("./resend-client", () => ({
  getResendClient: vi.fn(() => ({
    emails: { receiving: { get: getMock } },
  })),
}));

import {
  createOutboundMessageId,
  fetchReceivingEmail,
  threadingFromHeaders,
} from "./receiving-fetch";
import { getResendClient } from "./resend-client";

describe("threadingFromHeaders", () => {
  it("reads in-reply-to and references from headers (SDK v6 shape)", () => {
    expect(
      threadingFromHeaders({
        "in-reply-to": "<parent@example.com>",
        references: "<a@x.com> <parent@example.com>",
        from: "Someone <a@x.com>",
      }),
    ).toEqual({
      inReplyTo: "<parent@example.com>",
      references: "<a@x.com> <parent@example.com>",
    });
  });

  it("is case-insensitive on header names", () => {
    expect(
      threadingFromHeaders({
        "In-Reply-To": "<Parent@Example.COM>",
        References: "<r1@x.com>",
      }),
    ).toEqual({
      inReplyTo: "<Parent@Example.COM>",
      references: "<r1@x.com>",
    });
  });

  it("returns nulls when headers missing", () => {
    expect(threadingFromHeaders(null)).toEqual({
      inReplyTo: null,
      references: null,
    });
    expect(threadingFromHeaders({})).toEqual({
      inReplyTo: null,
      references: null,
    });
  });
});

describe("createOutboundMessageId", () => {
  it("returns an RFC-ish Message-ID at galladev.com", () => {
    const id = createOutboundMessageId();
    expect(id).toMatch(/^<[0-9a-f-]{36}@galladev\.com>$/i);
  });
});

describe("fetchReceivingEmail", () => {
  beforeEach(() => {
    getMock.mockReset();
    logRouteError.mockReset();
    vi.mocked(getResendClient).mockReturnValue({
      emails: { receiving: { get: getMock } },
    } as unknown as ReturnType<typeof getResendClient>);
  });

  it("requests html_format cid and returns bodies + headers", async () => {
    getMock.mockResolvedValue({
      data: {
        html: "<p>Hi</p>",
        text: "Hi",
        headers: { "in-reply-to": "<p@x.com>" },
        message_id: "<m@x.com>",
        attachments: [
          {
            id: "att-1",
            filename: "a.png",
            content_type: "image/png",
            size: 42,
            content_id: "cid1",
          },
        ],
      },
      error: null,
    });

    const result = await fetchReceivingEmail("em_1");
    expect(getMock).toHaveBeenCalledWith("em_1", { html_format: "cid" });
    expect(result).toEqual({
      ok: true,
      data: {
        html: "<p>Hi</p>",
        text: "Hi",
        headers: { "in-reply-to": "<p@x.com>" },
        messageId: "<m@x.com>",
        attachments: [
          {
            id: "att-1",
            filename: "a.png",
            content_type: "image/png",
            size: 42,
            content_id: "cid1",
          },
        ],
      },
    });
    expect(logRouteError).not.toHaveBeenCalled();
  });

  it("logs SDK error (e.g. 401) and does not swallow it", async () => {
    getMock.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "Unauthorized", statusCode: 401 },
    });

    const result = await fetchReceivingEmail("em_denied");
    expect(result).toEqual({
      ok: false,
      status: 401,
      errorName: "validation_error",
    });
    expect(logRouteError).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "email/receiving.get",
        status: 401,
        errorClass: "ResendReceiving:validation_error",
      }),
      "warn",
    );
  });

  it("returns no-client when Resend is not configured", async () => {
    vi.mocked(getResendClient).mockReturnValueOnce(null);
    const result = await fetchReceivingEmail("em_x");
    expect(result).toEqual({ ok: false, errorName: "no-client" });
    expect(getMock).not.toHaveBeenCalled();
  });
});
