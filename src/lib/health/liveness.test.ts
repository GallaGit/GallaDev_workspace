import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/health/route";
import { proxy } from "@/proxy";

describe("GET /api/health", () => {
  it("returns a minimal liveness payload and no secrets", async () => {
    const res = GET();

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    expect(JSON.stringify(body)).not.toMatch(
      /secret|password|token|supabase|key/i,
    );
  });

  it("is outside the session gate", async () => {
    const res = await proxy(new NextRequest("http://localhost/api/health"));
    expect(res.status).not.toBe(401);
    expect(res.headers.get("location")).toBeNull();
  });
});
