import { beforeEach, describe, expect, it, vi } from "vitest";

const logRouteError = vi.hoisted(() => vi.fn());
const getReceivingAtt = vi.fn();
const getSentAtt = vi.fn();

vi.mock("@/lib/route-log", () => ({
  logRouteError,
}));

vi.mock("./resend-client", () => ({
  getResendClient: vi.fn(() => ({
    emails: {
      receiving: { attachments: { get: getReceivingAtt } },
      attachments: { get: getSentAtt },
    },
  })),
}));

import { resolveAttachmentDownload } from "./attachment-download";
import { getResendClient } from "./resend-client";

const ATT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const MSG_ID = "11111111-2222-4333-8444-555555555555";

function mockSupabase(opts: {
  attachment?: Record<string, unknown> | null;
  message?: Record<string, unknown> | null;
} = {}) {
  const attachment =
    opts.attachment === undefined
      ? {
          id: ATT_ID,
          message_id: MSG_ID,
          filename: "doc.pdf",
          content_type: "application/pdf",
          size_bytes: 2048,
          resend_attachment_id: "att-resend-1",
        }
      : opts.attachment;
  const message =
    opts.message === undefined
      ? {
          id: MSG_ID,
          resend_email_id: "em_inbound_1",
          direction: "inbound",
          received_at: "2026-10-01T00:00:00.000Z",
        }
      : opts.message;

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "email_attachments") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: attachment,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "email_messages") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: message,
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    }),
  } as unknown as Parameters<typeof resolveAttachmentDownload>[0];
}

describe("resolveAttachmentDownload", () => {
  beforeEach(() => {
    getReceivingAtt.mockReset();
    getSentAtt.mockReset();
    logRouteError.mockReset();
    vi.mocked(getResendClient).mockReturnValue({
      emails: {
        receiving: { attachments: { get: getReceivingAtt } },
        attachments: { get: getSentAtt },
      },
    } as unknown as ReturnType<typeof getResendClient>);
  });

  it("returns signed URL for inbound attachment via receiving API", async () => {
    getReceivingAtt.mockResolvedValue({
      data: {
        id: "att-resend-1",
        download_url: "https://inbound-cdn.resend.com/x?sig=1",
        expires_at: "2026-10-09T15:00:00.000Z",
        filename: "doc.pdf",
        content_type: "application/pdf",
        size: 2048,
      },
      error: null,
    });

    const result = await resolveAttachmentDownload(mockSupabase(), ATT_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.downloadUrl).toContain("inbound-cdn.resend.com");
      expect(result.filename).toBe("doc.pdf");
      expect(result.contentType).toBe("application/pdf");
    }
    expect(getReceivingAtt).toHaveBeenCalledWith({
      emailId: "em_inbound_1",
      id: "att-resend-1",
    });
    expect(getSentAtt).not.toHaveBeenCalled();
  });

  it("uses sent-email attachments API for outbound messages", async () => {
    getSentAtt.mockResolvedValue({
      data: {
        id: "att-out-1",
        download_url: "https://cdn.resend.com/y?sig=2",
        expires_at: "2026-10-09T15:00:00.000Z",
        filename: "out.png",
        content_type: "image/png",
        size: 100,
      },
      error: null,
    });

    const result = await resolveAttachmentDownload(
      mockSupabase({
        attachment: {
          id: ATT_ID,
          message_id: MSG_ID,
          filename: "out.png",
          content_type: "image/png",
          size_bytes: 100,
          resend_attachment_id: "att-out-1",
        },
        message: {
          id: MSG_ID,
          resend_email_id: "re_sent_1",
          direction: "outbound",
          received_at: "2026-10-02T00:00:00.000Z",
        },
      }),
      ATT_ID,
    );

    expect(result.ok).toBe(true);
    expect(getSentAtt).toHaveBeenCalledWith({
      emailId: "re_sent_1",
      id: "att-out-1",
    });
    expect(getReceivingAtt).not.toHaveBeenCalled();
  });

  it("returns not-found when attachment row is missing (IDOR / unknown id)", async () => {
    const result = await resolveAttachmentDownload(
      mockSupabase({ attachment: null }),
      ATT_ID,
    );
    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(getReceivingAtt).not.toHaveBeenCalled();
  });

  it("returns not-found when message is missing (orphan / wrong tenant)", async () => {
    const result = await resolveAttachmentDownload(
      mockSupabase({ message: null }),
      ATT_ID,
    );
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it("returns expired when Resend responds 404", async () => {
    getReceivingAtt.mockResolvedValue({
      data: null,
      error: { name: "not_found", message: "Not found", statusCode: 404 },
    });

    const result = await resolveAttachmentDownload(mockSupabase(), ATT_ID);
    expect(result).toEqual({ ok: false, reason: "expired" });
    expect(logRouteError).toHaveBeenCalled();
  });

  it("rejects Resend payload whose attachment id does not match ours", async () => {
    getReceivingAtt.mockResolvedValue({
      data: {
        id: "att-OTHER",
        download_url: "https://inbound-cdn.resend.com/x?sig=1",
        expires_at: "2026-10-09T15:00:00.000Z",
        content_type: "application/pdf",
        size: 1,
      },
      error: null,
    });

    const result = await resolveAttachmentDownload(mockSupabase(), ATT_ID);
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it("returns no-resend-id when metadata lacks Resend attachment id", async () => {
    const result = await resolveAttachmentDownload(
      mockSupabase({
        attachment: {
          id: ATT_ID,
          message_id: MSG_ID,
          filename: "x.bin",
          content_type: "application/octet-stream",
          size_bytes: null,
          resend_attachment_id: null,
        },
      }),
      ATT_ID,
    );
    expect(result).toEqual({ ok: false, reason: "no-resend-id" });
  });
});
