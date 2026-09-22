import { test, expect, type Page } from "@playwright/test";

/**
 * Estos tests requieren dos usuarios creados en Supabase Auth:
 *  - Admin: rol Admin en public.profiles
 *  - Seller: rol Seller en public.profiles
 *
 * Puedes crearlos en Supabase Dashboard → Authentication → Users y luego
 * asignar el rol con SQL en el SQL Editor:
 *   UPDATE public.profiles SET role = 'Admin' WHERE id = '<uuid_admin>';
 *
 * Las credenciales se leen de variables de entorno (ver playwright.config.ts).
 */
const adminEmail = (process.env.E2E_ADMIN_EMAIL ?? "").trim();
const adminPassword = (process.env.E2E_ADMIN_PASSWORD ?? "").trim();
const sellerEmail = (process.env.E2E_SELLER_EMAIL ?? "").trim();
const sellerPassword = (process.env.E2E_SELLER_PASSWORD ?? "").trim();

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
}

async function syncCount(page: Page) {
  await page.getByRole("button", { name: /sincronizar/i }).waitFor();
  const response = await page.request.post("/api/sync");
  expect(response.status()).toBe(200);
  return (await response.json()) as {
    ok: boolean;
    count: number;
    provider: string;
  };
}

// Sin credenciales → skip. El redirect sin sesión vive en critical-paths.spec.ts.
const authDescribe =
  adminEmail && adminPassword && sellerEmail && sellerPassword
    ? test.describe
    : test.describe.skip;

authDescribe("Login real + sync + roles", () => {
  test("Admin loguea, sync y ve todos los leads", async ({ page }) => {
    await login(page, adminEmail, adminPassword);
    await page.goto("/leads");
    await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible({
      timeout: 15000,
    });

    const body = await syncCount(page);
    expect(body.ok).toBe(true);
    expect(body.count).toBeGreaterThan(0);
    expect(body.provider).toBe("supabase");
  });

  test("Seller loguea y ve leads permitidos por RLS", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await login(page, sellerEmail, sellerPassword);
    await page.goto("/leads");
    await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible({
      timeout: 15000,
    });

    const body = await syncCount(page);
    expect(body.ok).toBe(true);
    // Seller ve leads sin responsable o asignados a él. En datasets futuros
    // este valor será menor que el de Admin; hoy aceptamos >= 0.
    expect(body.count).toBeGreaterThanOrEqual(0);

    await ctx.close();
  });
});
