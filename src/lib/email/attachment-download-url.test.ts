import { describe, expect, it } from "vitest";
import { isTrustedResendDownloadUrl } from "./attachment-download";

describe("isTrustedResendDownloadUrl (GDW-SEC-023)", () => {
  it.each([
    "https://inbound-cdn.resend.com/x?sig=1",
    "https://cdn.resend.com/y",
    "https://resend.com/a",
    "https://files.resend.dev/a",
  ])("acepta %s", (u) => expect(isTrustedResendDownloadUrl(u)).toBe(true));

  it.each([
    "http://cdn.resend.com/x",
    "https://evil.com/x",
    "https://resend.com.evil.com/x",
    "https://evilresend.com/x",
    "https://user:pw@cdn.resend.com/x",
    "javascript:alert(1)",
    "not a url",
    "",
    null,
  ])("rechaza %s", (u) => expect(isTrustedResendDownloadUrl(u)).toBe(false));
});
