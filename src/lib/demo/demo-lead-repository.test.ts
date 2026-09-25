import { describe, expect, it } from "vitest";
import { LEAD_STATUSES } from "@/lib/domain/lead";
import { hasStructuredPainAnalysis } from "@/lib/ai/pain-analysis";
import { DemoReadOnlyError, getDemoLeadRepository } from "./demo-lead-repository";
import { DEMO_LEADS } from "./seed";

const FICTIONAL_EMAIL = /example\.(com|test)$/;

describe("repositorio de demo", () => {
  it("devuelve solo leads ficticios, repartidos por el pipeline y con análisis enlatado", async () => {
    const repo = getDemoLeadRepository();
    const leads = await repo.list();
    expect(leads.length).toBeGreaterThanOrEqual(15);
    expect(leads.length).toBeLessThanOrEqual(25);
    expect(leads).toHaveLength(DEMO_LEADS.length);

    const statuses = new Set(leads.map((lead) => lead.status));
    for (const status of LEAD_STATUSES) {
      expect(statuses.has(status)).toBe(true);
    }

    const withAnalysis = leads.filter((lead) =>
      hasStructuredPainAnalysis(lead.aiAnalysis),
    );
    expect(withAnalysis.length).toBeGreaterThanOrEqual(3);

    for (const lead of leads) {
      expect(lead.id.startsWith("demo-")).toBe(true);
      expect(lead.source).toBe("demo");
      expect(lead.email).toMatch(FICTIONAL_EMAIL);
      expect(lead.emailCommercial ?? "").toMatch(FICTIONAL_EMAIL);
      expect(lead.phone).toMatch(/^\+34 600 000 /);
      expect(lead.website ?? "").toMatch(/\.example\.com$/);
      expect(lead.companyName.toLowerCase()).toContain("ejemplo");
    }
  });

  it("no muta el seed si se intenta escribir", async () => {
    const repo = getDemoLeadRepository();
    const before = (await repo.list()).map((lead) => lead.status);
    await expect(repo.update("demo-01", { status: "Cliente" })).rejects.toBeInstanceOf(
      DemoReadOnlyError,
    );
    await expect(
      repo.create({ companyName: "No debería existir" }),
    ).rejects.toBeInstanceOf(DemoReadOnlyError);
    await expect(repo.archive("demo-01")).rejects.toBeInstanceOf(DemoReadOnlyError);
    const after = (await repo.list()).map((lead) => lead.status);
    expect(after).toEqual(before);
    expect((await repo.get("demo-01"))?.status).toBe(before[0]);
  });
});
