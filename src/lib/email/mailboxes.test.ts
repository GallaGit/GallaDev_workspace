import { describe, expect, it } from "vitest";
import {
  isAllowedRecipient,
  isValidExternalEmail,
  resolveMailbox,
  displayFrom,
  mailboxChipLabel,
  extractEmailAddress,
} from "./mailboxes";

describe("mailboxes", () => {
  it("extractEmailAddress handles angle brackets", () => {
    expect(extractEmailAddress("Ociel <ociel@galladev.com>")).toBe("ociel@galladev.com");
    expect(extractEmailAddress("hola@galladev.com")).toBe("hola@galladev.com");
  });

  it("isAllowedRecipient accepts hola@ and ociel@", () => {
    expect(isAllowedRecipient(["hola@galladev.com"])).toBe(true);
    expect(isAllowedRecipient(["Ociel <ociel@galladev.com>"])).toBe(true);
    expect(isAllowedRecipient(["otro@galladev.com"])).toBe(false);
  });

  it("resolveMailbox prefers to over cc and company order", () => {
    expect(resolveMailbox(["ociel@galladev.com"], ["hola@galladev.com"])).toBe(
      "ociel@galladev.com",
    );
    expect(resolveMailbox(["otro@x.com"], ["hola@galladev.com"])).toBe(
      "hola@galladev.com",
    );
    expect(
      resolveMailbox(["hola@galladev.com", "ociel@galladev.com"]),
    ).toBe("hola@galladev.com");
    expect(resolveMailbox(["spam@example.com"])).toBeNull();
  });

  it("displayFrom returns Resend From strings", () => {
    expect(displayFrom("hola@galladev.com").from).toBe(
      "GallaDev <hola@galladev.com>",
    );
    expect(displayFrom("ociel@galladev.com").from).toBe(
      "Ociel <ociel@galladev.com>",
    );
  });

  it("isValidExternalEmail rejects newlines and garbage", () => {
    expect(isValidExternalEmail("Name <ana@example.com>")).toBe(true);
    expect(isValidExternalEmail("ana@example.com\nBcc: x@y.z")).toBe(false);
    expect(isValidExternalEmail("not-an-email")).toBe(false);
  });

  it("mailboxChipLabel shortens local-part", () => {
    expect(mailboxChipLabel("hola@galladev.com")).toBe("hola");
    expect(mailboxChipLabel("ociel@galladev.com")).toBe("ociel");
  });
});
