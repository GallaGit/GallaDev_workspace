import { test, expect } from "@playwright/test";

/**
 * Rutas del módulo Correo. No requieren credenciales: comprueban que las
 * rutas por carpeta existen detrás del login y que el visitante demo no
 * puede entrar (el contenido real se cubre en los tests de componentes).
 */
const RUTAS = [
  "/correo",
  "/correo/recibidos",
  "/correo/enviados",
  "/correo/archivados",
  "/correo/papelera",
  "/correo/borradores",
  "/correo/recibidos?cuenta=hola",
];

for (const ruta of RUTAS) {
  test(`sin sesión ${ruta} redirige a /login`, async ({ page }) => {
    await page.goto(ruta);
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });
}

test("el visitante demo no entra en /correo ni en sus carpetas", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByTestId("demo-enter").click();
  await expect(page).toHaveURL(/\/leads/, { timeout: 15000 });

  for (const ruta of ["/correo", "/correo/recibidos", "/correo/papelera"]) {
    await page.goto(ruta);
    await expect(page).toHaveURL(/\/leads/, { timeout: 15000 });
  }
});
