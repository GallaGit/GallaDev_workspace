import { test, expect } from "@playwright/test";

/**
 * Demo sin cuenta. No usa E2E_TEST_EMAIL / E2E_TEST_PASSWORD:
 * el servidor de Playwright arranca con DEMO_MODE_ENABLED=true.
 */
test("visitante entra, recorre leads, kanban y estadísticas, y sale", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByTestId("demo-enter")).toBeVisible();

  await page.getByTestId("demo-enter").click();
  await expect(page).toHaveURL(/\/leads/, { timeout: 15000 });
  await expect(page.getByTestId("demo-banner")).toBeVisible();
  await expect(
    page.getByText("Estás viendo una demo con datos ficticios"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
  await expect(page.getByText("Asesoría Ejemplo Levante")).toBeVisible({
    timeout: 15000,
  });

  await page.getByText("Fiscal Ejemplo Albufera").click();
  await expect(page.getByText("Evidencia")).toBeVisible();

  await page.goto("/kanban");
  await expect(page.getByRole("heading", { name: "Kanban" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Nuevo", level: 3 }),
  ).toBeVisible();
  await expect(page.getByText("Asesoría Ejemplo Levante")).toBeVisible();

  await page.goto("/stats");
  await expect(page.getByRole("heading", { name: "Statistics" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Por estado" }),
  ).toBeVisible();

  const blocked = await page.request.get("/api/team");
  expect(blocked.status()).toBe(403);

  await page.getByTestId("demo-exit").click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  await expect(page.getByTestId("demo-enter")).toBeVisible();

  await page.goto("/leads");
  await expect(page).toHaveURL(/\/login/);
});
