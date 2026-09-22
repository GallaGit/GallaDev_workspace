import { test, expect } from "@playwright/test";

test.describe("Leads_CRM smoke", () => {
  // Paso 2: el servidor E2E corre en producción con Supabase Auth;
  // cada test entra por /login con el usuario de prueba (E2E_TEST_EMAIL
  // + E2E_TEST_PASSWORD, creado a mano en el proyecto Supabase).
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page
      .getByTestId("login-email")
      .fill(process.env.E2E_TEST_EMAIL ?? "e2e@test.local");
    await page
      .getByTestId("login-password")
      .fill(process.env.E2E_TEST_PASSWORD ?? "e2e-test-password");
    await page.getByTestId("login-submit").click();
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
