import { test, expect } from "@playwright/test";

/**
 * Idioma por defecto español; el selector ES/EN persiste en cookie NEXT_LOCALE.
 */
test("el selector de idioma cambia a inglés y vuelve a español", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByTestId("locale-switcher")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await expect(page.getByTestId("locale-es")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByTestId("locale-en").click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByTestId("locale-en")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  const cookies = await page.context().cookies();
  expect(cookies.some((c) => c.name === "NEXT_LOCALE" && c.value === "en")).toBe(
    true,
  );

  await page.getByTestId("locale-es").click();
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible({
    timeout: 10000,
  });
});
