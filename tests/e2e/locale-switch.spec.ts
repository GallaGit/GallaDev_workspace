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

  const trigger = page.getByTestId("locale-trigger");
  await expect(trigger).toHaveAttribute("data-locale", "es");
  await expect(trigger).toHaveText("ES");
  await expect(trigger).toHaveAttribute("aria-label", "Cambiar a English");

  await trigger.click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByTestId("locale-trigger")).toHaveAttribute(
    "data-locale",
    "en",
  );
  await expect(page.getByTestId("locale-trigger")).toHaveText("EN");
  await expect(page.getByTestId("locale-trigger")).toHaveAttribute(
    "aria-label",
    "Switch to Español",
  );

  const cookies = await page.context().cookies();
  expect(cookies.some((c) => c.name === "NEXT_LOCALE" && c.value === "en")).toBe(
    true,
  );

  await page.getByTestId("locale-trigger").click();
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByTestId("locale-trigger")).toHaveText("ES");
});
