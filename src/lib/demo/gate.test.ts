import { describe, expect, it } from "vitest";
import {
  isVisitorAllowedApi,
  isVisitorAllowedPage,
  isVisitorBlockedApi,
  isVisitorBlockedPage,
} from "./gate";

describe("lista blanca del visitante", () => {
  it("deja las lecturas de la demo", () => {
    expect(isVisitorAllowedPage("/")).toBe(true);
    expect(isVisitorAllowedPage("/leads")).toBe(true);
    expect(isVisitorAllowedPage("/kanban")).toBe(true);
    expect(isVisitorAllowedPage("/stats")).toBe(true);
    expect(isVisitorAllowedPage("/inbox")).toBe(true);
    expect(isVisitorAllowedApi("/api/leads", "GET")).toBe(true);
    expect(isVisitorAllowedApi("/api/leads/demo-01", "GET")).toBe(true);
    expect(isVisitorAllowedApi("/api/leads/duplicates", "GET")).toBe(true);
    expect(isVisitorAllowedApi("/api/session", "GET")).toBe(true);
    expect(isVisitorAllowedApi("/api/sync", "POST")).toBe(true);
  });

  it("niega lo que no está en la lista, incluidas rutas nuevas", () => {
    expect(isVisitorAllowedPage("/settings")).toBe(false);
    expect(isVisitorAllowedPage("/pending")).toBe(false);
    expect(isVisitorAllowedPage("/reports")).toBe(false);
    expect(isVisitorBlockedApi("/api/reports", "GET")).toBe(true);
    expect(isVisitorBlockedApi("/api/leads", "POST")).toBe(true);
    expect(isVisitorBlockedApi("/api/leads/demo-01/analyze", "POST")).toBe(true);
    expect(isVisitorBlockedApi("/api/email/inbound", "POST")).toBe(true);
    expect(isVisitorAllowedApi("/api/leads/score", "GET")).toBe(false);
    expect(isVisitorBlockedApi("/leads", "GET")).toBe(false);
    expect(isVisitorBlockedPage("/api/leads")).toBe(false);
    expect(isVisitorBlockedPage("/settings")).toBe(true);
  });
});
