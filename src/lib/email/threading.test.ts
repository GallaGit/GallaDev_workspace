import { describe, expect, it } from "vitest";
import {
  forwardSubject,
  hasReplyPrefix,
  messageIdLookupVariants,
  normalizeMessageId,
  normalizeSubject,
  parseMessageIdList,
  pickSubjectMatch,
  replyAllRecipients,
  replySubject,
} from "./threading";

describe("normalizeMessageId", () => {
  it("adds brackets, trims and lowercases", () => {
    expect(normalizeMessageId("  ABC@Mail.Gmail.com ")).toBe("<abc@mail.gmail.com>");
    expect(normalizeMessageId("<x@y>")).toBe("<x@y>");
    expect(normalizeMessageId("")).toBeNull();
    expect(normalizeMessageId("<>")).toBeNull();
  });
});

describe("parseMessageIdList", () => {
  it("parses folded References with brackets and whitespace", () => {
    expect(
      parseMessageIdList("<a@x>\r\n\t<B@y>   <a@x>,<c@z>"),
    ).toEqual(["<a@x>", "<b@y>", "<c@z>"]);
  });
  it("accepts ids without brackets", () => {
    expect(parseMessageIdList("a@x b@y")).toEqual(["<a@x>", "<b@y>"]);
  });
  it("returns [] for empty", () => {
    expect(parseMessageIdList(null)).toEqual([]);
  });
});

describe("messageIdLookupVariants", () => {
  it("includes raw, bracketed lower and bare", () => {
    const v = messageIdLookupVariants(["<CAH2@mail.gmail.com>"]);
    expect(v).toContain("<CAH2@mail.gmail.com>");
    expect(v).toContain("<cah2@mail.gmail.com>");
    expect(v).toContain("cah2@mail.gmail.com");
  });
});

describe("subjects", () => {
  it("strips Re:/RE:/Fwd:/FW:/RV: repeatedly", () => {
    expect(normalizeSubject("RE: Fwd: rv: FW:  Presupuesto  web")).toBe("presupuesto web");
    expect(normalizeSubject("Re[2]: hola")).toBe("hola");
  });
  it("detects reply prefixes", () => {
    expect(hasReplyPrefix("Re: adjunto")).toBe(true);
    expect(hasReplyPrefix("Reunión")).toBe(false);
  });
  it("builds reply and forward subjects without stacking", () => {
    expect(replySubject("RE: x")).toBe("RE: x");
    expect(replySubject("x")).toBe("Re: x");
    expect(forwardSubject("Fwd: x")).toBe("Fwd: x");
    expect(forwardSubject("Re: x")).toBe("Fwd: Re: x");
  });
});

describe("pickSubjectMatch", () => {
  const base = {
    to_addresses: ["ociel@galladev.com"],
    cc_addresses: [],
  };
  it("matches normalized subject and counterpart, newest first", () => {
    const id = pickSubjectMatch(
      [
        { ...base, thread_id: "old", subject: "adjunto prueba", from_address: "a@x.com", received_at: "2026-10-01T00:00:00Z" },
        { ...base, thread_id: "new", subject: "Re: adjunto prueba", from_address: "ociel@galladev.com", to_addresses: ["a@x.com"], received_at: "2026-10-09T00:00:00Z" },
        { ...base, thread_id: "other", subject: "adjunto prueba", from_address: "b@x.com", received_at: "2026-10-10T00:00:00Z" },
      ],
      { subject: "RE: Adjunto prueba", counterpart: "A@x.com" },
    );
    expect(id).toBe("new");
  });
  it("skips excluded thread", () => {
    expect(
      pickSubjectMatch(
        [{ ...base, thread_id: "self", subject: "x", from_address: "a@x.com", received_at: "2026-10-01T00:00:00Z" }],
        { subject: "Re: x", counterpart: "a@x.com", excludeThreadId: "self" },
      ),
    ).toBeNull();
  });
});

describe("replyAllRecipients", () => {
  const own = (a: string) => a.endsWith("@galladev.com");
  it("inbound: sender + To, Cc, minus own and dupes", () => {
    expect(
      replyAllRecipients(
        { direction: "inbound", from_address: "a@x.com", to_addresses: ["hola@galladev.com", "b@x.com"], cc_addresses: ["C@x.com", "a@x.com"] },
        own,
      ),
    ).toEqual({ to: ["a@x.com", "b@x.com"], cc: ["c@x.com"] });
  });
  it("outbound: replies to its To/Cc", () => {
    expect(
      replyAllRecipients(
        { direction: "outbound", from_address: "hola@galladev.com", to_addresses: ["a@x.com"], cc_addresses: ["b@x.com"] },
        own,
      ),
    ).toEqual({ to: ["a@x.com"], cc: ["b@x.com"] });
  });
});
