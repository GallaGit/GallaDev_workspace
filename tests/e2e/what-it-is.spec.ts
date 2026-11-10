import { test, expect } from "@playwright/test";

/**
 * Sección pública «¿Qué es?» en /login. No pide sesión ni depende de
 * DEMO_MODE_ENABLED (el servidor de Playwright la deja encendida, así que
 * también se comprueba que convive con «Entrar como visitante»).
 */
test("la sección Qué es se ve sin sesión y no bloquea el formulario", async ({
  page,
}) => {
  await page.route("**/what-it-is/**", (route) => route.abort());
  await page.goto("/login");

  const section = page.getByTestId("what-it-is");
  await expect(section).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "¿Qué es?" }),
  ).toBeVisible();
  await expect(
    section.getByText(
      "GallaDev Workspace es un CRM para revisar, cualificar y gestionar leads de asesorías y gestorías.",
    ),
  ).toBeVisible();

  await expect(page.getByTestId("login-email")).toBeVisible();
  await expect(page.getByTestId("login-password")).toBeVisible();
  await page.getByTestId("login-email").fill("ana@example.com");
  await page.getByTestId("login-password").fill("secret");
  await expect(page.getByTestId("login-submit")).toBeEnabled();

  await expect(page.getByTestId("demo-enter")).toBeVisible();
});

test("las capturas tienen pie y texto alternativo", async ({ page }) => {
  await page.goto("/login");
  const section = page.getByTestId("what-it-is");

  await expect(
    section.getByRole("img", {
      name: "Lista de leads en tema claro: tres asesorías ficticias con estado y ciudad de ejemplo.",
    }),
  ).toBeVisible();
  await expect(
    section.getByRole("img", {
      name: "Tablero Kanban en tema claro con columnas del pipeline y tarjetas de empresas ficticias.",
    }),
  ).toBeVisible();
  await expect(
    section.getByRole("img", {
      name: "Página de estadísticas en tema claro: gráfico de barras con cifras ficticias del pipeline.",
    }),
  ).toBeVisible();
  await expect(
    section.getByRole("img", {
      name: "Panel de un lead ficticio en tema claro, con el bloque de análisis de dolores visible.",
    }),
  ).toBeVisible();

  await expect(section.getByText("Lista de leads.")).toBeVisible();
  await expect(section.getByText("Kanban.")).toBeVisible();
  await expect(section.getByText("Estadísticas.")).toBeVisible();
  await expect(section.getByText("Detalle de un lead.")).toBeVisible();
});

test("en inglés la sección muestra What is it?", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("locale-trigger").click();
  await expect(
    page.getByRole("heading", { level: 2, name: "What is it?" }),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByText(
      /GallaDev Workspace is a CRM for reviewing, qualifying, and managing leads/,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Light-theme lead list: three fictional advisory firms with sample status and city.",
    }),
  ).toBeVisible();
});
