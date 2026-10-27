import { test, expect, type Page } from "@playwright/test";

const viewerEmail = (process.env.E2E_VIEWER_EMAIL ?? "").trim();
const viewerPassword = (process.env.E2E_VIEWER_PASSWORD ?? "").trim();

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
}

const viewerDescribe =
  viewerEmail && viewerPassword ? test.describe : test.describe.skip;

viewerDescribe("RBAC Viewer: solo lectura", () => {
  test("Viewer loguea y las mutaciones devuelven 403", async ({ page }) => {
    await login(page, viewerEmail, viewerPassword);

    const cases = [
      {
        name: "POST /api/leads",
        method: "POST" as const,
        url: "/api/leads",
        data: { name: "x" },
      },
      {
        name: "PATCH /api/leads (masivo)",
        method: "PATCH" as const,
        url: "/api/leads",
        data: { ids: [], patch: {} },
      },
      {
        name: "PATCH /api/leads/:id",
        method: "PATCH" as const,
        url: "/api/leads/00000000-0000-4000-8000-000000000000",
        data: { status: "Contacted" },
      },
      {
        name: "DELETE /api/leads/:id",
        method: "DELETE" as const,
        url: "/api/leads/00000000-0000-4000-8000-000000000000",
      },
      {
        name: "PATCH /api/settings",
        method: "PATCH" as const,
        url: "/api/settings",
        data: {},
      },
      {
        name: "GET /api/team",
        method: "GET" as const,
        url: "/api/team",
      },
      {
        name: "PATCH /api/team",
        method: "PATCH" as const,
        url: "/api/team",
        data: {
          id: "11111111-1111-4111-8111-111111111111",
          role: "Admin",
        },
      },
      {
        name: "POST /api/leads/:id/analyze",
        method: "POST" as const,
        url: "/api/leads/00000000-0000-4000-8000-000000000000/analyze",
      },
      {
        name: "POST /api/leads/pain-analysis",
        method: "POST" as const,
        url: "/api/leads/pain-analysis",
        data: {},
      },
      {
        name: "POST /api/leads/score",
        method: "POST" as const,
        url: "/api/leads/score",
        data: {},
      },
    ];

    for (const c of cases) {
      const res = await page.request.fetch(c.url, {
        method: c.method,
        data: c.data,
      });
      expect(res.status(), c.name).toBe(403);
    }
  });
});
