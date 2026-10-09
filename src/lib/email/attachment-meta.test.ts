import { describe, expect, it } from "vitest";
import {
  formatAttachmentSize,
  isPreviewableContentType,
} from "./attachment-meta";

describe("isPreviewableContentType", () => {
  it("accepts pdf and common images", () => {
    expect(isPreviewableContentType("application/pdf")).toBe(true);
    expect(isPreviewableContentType("image/png")).toBe(true);
    expect(isPreviewableContentType("image/jpeg; charset=binary")).toBe(true);
  });

  it("rejects other types", () => {
    expect(isPreviewableContentType("application/zip")).toBe(false);
    expect(isPreviewableContentType("text/plain")).toBe(false);
  });
});

describe("formatAttachmentSize", () => {
  it("formats bytes, KB and MB", () => {
    expect(formatAttachmentSize(500)).toBe("500 B");
    expect(formatAttachmentSize(2048)).toBe("2 KB");
    expect(formatAttachmentSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("returns empty for missing sizes", () => {
    expect(formatAttachmentSize(null)).toBe("");
    expect(formatAttachmentSize(undefined)).toBe("");
  });
});
