import { test, expect } from "@playwright/test";

test.describe("Leads_CRM smoke", () => {
  // M1: el servidor E2E corre en producción (npm run start) con auth
  // activo; cada test entra por /login con las credenciales de prueba
  // del webServer (E2E_AUTH_PASSWORD o el default local).
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Contraseña").fill(
      process.env.E2E_AUTH_PASSWORD ?? "e2e-test-password",
    );
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
  });

  test("home shell loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Leads_CRM").first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("leads route renders chrome", async ({ page }) => {
    await page.goto("/leads");
    await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible({
      timeout: 15000,
    });
  });

  test("kanban route renders", async ({ page }) => {
    await page.goto("/kanban");
    await expect(page.getByRole("heading", { name: "Kanban" })).toBeVisible({
      timeout: 15000,
    });
  });

  test("settings route renders", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({
      timeout: 15000,
    });
  });
});
