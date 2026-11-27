import { test, expect } from "@playwright/test";

/**
 * «¿Qué es?» vive en la página pública /que-es. /login solo enseña un botón
 * discreto que la abre en una pestaña nueva. Ninguna de las dos pide sesión.
 */
const SHOTS = [
  "/what-it-is/leads-light.webp",
  "/what-it-is/kanban-light.webp",
  "/what-it-is/correo-light.webp",
  "/what-it-is/detail-light.webp",
];

test("/login no incluye la sección y enseña el enlace ¿Qué es?", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByTestId("what-it-is")).toHaveCount(0);
  await expect(page.getByTestId("login-email")).toBeVisible();
  const link = page.getByTestId("what-it-is-link");
  await expect(link).toHaveText("¿Qué es?");
  await expect(link).toHaveAttribute("href", "/que-es");
  await expect(link).toHaveAttribute("target", "_blank");
});

test("el enlace abre /que-es en una pestaña nueva sin sesión", async ({
  page,
}) => {
  await page.goto("/login");
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByTestId("what-it-is-link").click(),
  ]);
  await expect(popup).toHaveURL(/\/que-es$/);
  await expect(
    popup.getByRole("heading", { level: 2, name: "¿Qué es?" }),
  ).toBeVisible();
  await expect(popup.getByText(/^Incluye el buzón de empresa/)).toBeVisible();
  await popup.getByTestId("what-it-is-back").click();
  await expect(popup).toHaveURL(/\/login/);
});

test("las capturas se sirven con HTTP 200 y se cargan sin sesión", async ({
  page,
  request,
}) => {
  for (const src of SHOTS) {
    const res = await request.get(src, { maxRedirects: 0 });
    expect(res.status(), src).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/webp");
  }
  await page.goto("/que-es");
  const imgs = page.locator('[data-testid="what-it-is"] img');
  await expect(imgs).toHaveCount(SHOTS.length);
  for (let i = 0; i < SHOTS.length; i++) {
    const img = imgs.nth(i);
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
  }
});

test("las capturas tienen pie y texto alternativo", async ({ page }) => {
  await page.goto("/que-es");
  const section = page.getByTestId("what-it-is");
  await expect(
    section.getByRole("img", {
      name: /Bandeja de entrada de Correo en tema claro/,
    }),
  ).toBeAttached();
  await expect(section.getByRole("img")).toHaveCount(4);
  await expect(section.getByText("Lista de leads.")).toBeVisible();
  await expect(section.getByText("Kanban.")).toBeVisible();
  await expect(section.getByText("Correo.")).toBeVisible();
  await expect(section.getByText("Detalle de un lead.")).toBeVisible();
});

test("en inglés /que-es muestra What is it?", async ({ page }) => {
  await page.goto("/que-es");
  await page.getByTestId("locale-trigger").click();
  await expect(
    page.getByRole("heading", { level: 2, name: "What is it?" }),
  ).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/^It includes the company mailbox/)).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Light-theme Correo inbox/ }),
  ).toBeAttached();
  await expect(page.getByTestId("what-it-is-back")).toHaveText(
    "Back to sign in",
  );
});
