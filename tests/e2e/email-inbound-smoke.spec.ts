import { expect, test } from "@playwright/test";

/**
 * El build real arranca con `next start`. Si sanitize-html no carga,
 * el módulo de la ruta revienta y este GET es 500 con cuerpo vacío.
 * Sin handler GET, la respuesta correcta es 405.
 */
test("GET /api/email/inbound responde 405", async ({ request }) => {
  const res = await request.get("/api/email/inbound");
  expect(res.status()).toBe(405);
});

test("POST /api/email/inbound sin firma Svix responde JSON 400", async ({
  request,
}) => {
  const res = await request.post("/api/email/inbound", { data: {} });
  expect(res.status()).toBe(400);
  const body = (await res.json()) as { ok?: boolean };
  expect(body.ok).toBe(false);
});
