import { test, expect, type Page } from "@playwright/test";

/**
 * Smoke E2E tras el corte a Supabase Auth.
 *
 * Requiere un usuario real en Supabase Auth + fila en public.profiles.
 * Credenciales vía E2E_TEST_EMAIL / E2E_TEST_PASSWORD (GitHub Secrets en CI).
 * Si faltan, se omite el login smoke (el redirect sin sesión sí se ejecuta).
 */
function envCred(name: string): string {
  return (process.env[name] ?? "").trim();
}

const testEmail = envCred("E2E_TEST_EMAIL");
const testPassword = envCred("E2E_TEST_PASSWORD");
const hasLoginCreds = Boolean(testEmail && testPassword);

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  const submit = page.getByTestId("login-submit");
  await expect(submit).toBeEnabled({ timeout: 5000 });
  await submit.click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
}

test("sin sesión /leads redirige a /login", async ({ page }) => {
  await page.goto("/leads");
  await expect(page).toHaveURL(/\/login/);
});

const smokeDescribe = hasLoginCreds ? test.describe : test.describe.skip;

smokeDescribe("Leads_CRM smoke (login Supabase)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, testEmail, testPassword);
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
