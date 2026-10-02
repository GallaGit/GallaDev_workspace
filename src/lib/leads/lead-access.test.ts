import { describe, expect, it } from "vitest";
import {
  assignmentAllowed,
  canReadLead,
  canWriteLead,
  type LeadActor,
} from "./lead-access";

const admin: LeadActor = { id: "admin-1", role: "Admin" };
const seller: LeadActor = { id: "seller-1", role: "Seller" };
const other: LeadActor = { id: "seller-2", role: "Seller" };
const viewer: LeadActor = { id: "viewer-1", role: "Viewer" };

describe("acceso a leads (mismo predicado que RLS)", () => {
  it("Admin lee y escribe leads sin responsable y ajenos", () => {
    const unassigned = { responsibleId: null };
    const foreign = { responsibleId: "seller-1" };
    expect(canReadLead(admin, unassigned)).toBe(true);
    expect(canWriteLead(admin, unassigned)).toBe(true);
    expect(canReadLead(admin, foreign)).toBe(true);
    expect(canWriteLead(admin, foreign)).toBe(true);
    expect(assignmentAllowed(admin, null)).toBe(true);
    expect(assignmentAllowed(admin, "seller-2")).toBe(true);
  });

  it("Seller solo lee y escribe los leads que ya son suyos", () => {
    expect(canReadLead(seller, { responsibleId: "seller-1" })).toBe(true);
    expect(canWriteLead(seller, { responsibleId: "seller-1" })).toBe(true);
    expect(canReadLead(seller, { responsibleId: null })).toBe(false);
    expect(canWriteLead(seller, { responsibleId: null })).toBe(false);
    expect(canReadLead(seller, { responsibleId: "seller-2" })).toBe(false);
    expect(canWriteLead(other, { responsibleId: "seller-1" })).toBe(false);
  });

  it("Seller no puede soltar un lead ni pasarlo a otro", () => {
    expect(assignmentAllowed(seller, "seller-1")).toBe(true);
    expect(assignmentAllowed(seller, null)).toBe(false);
    expect(assignmentAllowed(seller, "seller-2")).toBe(false);
  });

  it("pasar a Cliente usa el mismo predicado de escritura", () => {
    const own = { responsibleId: "seller-1", status: "Cliente" };
    const inbox = { responsibleId: null, status: "Cliente" };
    expect(canWriteLead(seller, own)).toBe(true);
    expect(canWriteLead(seller, inbox)).toBe(false);
    expect(canWriteLead(admin, inbox)).toBe(true);
    expect(canWriteLead(viewer, own)).toBe(false);
  });

  it("Viewer lee toda la cartera, incluida la cola sin responsable, y no escribe", () => {
    expect(canReadLead(viewer, { responsibleId: null })).toBe(true);
    expect(canReadLead(viewer, { responsibleId: "seller-1" })).toBe(true);
    expect(canWriteLead(viewer, { responsibleId: null })).toBe(false);
    expect(canWriteLead(viewer, { responsibleId: "viewer-1" })).toBe(false);
    expect(assignmentAllowed(viewer, null)).toBe(false);
  });
});
