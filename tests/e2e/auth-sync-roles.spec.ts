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
 * En CI los crea scripts/e2e-seed.mjs contra un Supabase local (ver ci.yml).
 * Las credenciales se leen de variables de entorno (ver playwright.config.ts).
 * Sin ellas el bloque se omite.
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
    leads: { companyName: string }[];
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
    // scripts/e2e-seed.mjs siembra 6 leads: el Admin los ve todos.
    expect(body.count).toBeGreaterThanOrEqual(6);
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
    // Desde SEC-003 el Seller solo ve los leads donde es responsable: 3 de los
    // 6 sembrados (2 sin asignar y 1 del Admin quedan fuera por RLS).
    expect(body.count).toBe(3);
    expect(body.leads.map((l) => l.companyName)).toEqual(
      expect.arrayContaining(["Seller Uno SL"]),
    );

    await ctx.close();
  });
});
