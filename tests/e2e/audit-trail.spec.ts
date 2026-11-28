import { test, expect, type Browser, type Page } from "@playwright/test";

/**
 * Historial (audit trail) contra el Supabase local sembrado por
 * scripts/e2e-seed.mjs. Sin credenciales E2E_* el bloque se omite.
 */
const env = (key: string) => (process.env[key] ?? "").trim();
const adminEmail = env("E2E_ADMIN_EMAIL");
const adminPassword = env("E2E_ADMIN_PASSWORD");
const sellerEmail = env("E2E_SELLER_EMAIL");
const sellerPassword = env("E2E_SELLER_PASSWORD");
const viewerEmail = env("E2E_VIEWER_EMAIL");
const viewerPassword = env("E2E_VIEWER_PASSWORD");
const supabaseUrl = env("SUPABASE_URL");
const publishableKey = env("SUPABASE_PUBLISHABLE_KEY");

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
}

async function loggedInPage(browser: Browser, email: string, password: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, email, password);
  return { page, close: () => ctx.close() };
}

async function leadIdByName(page: Page, name: string): Promise<string> {
  const res = await page.request.post("/api/sync");
  expect(res.status()).toBe(200);
  const body = (await res.json()) as {
    leads: { id: string; companyName: string }[];
  };
  const lead = body.leads.find((l) => l.companyName === name);
  expect(lead, `lead ${name}`).toBeTruthy();
  return lead!.id;
}

type HistoryBody = {
  entries: {
    action: string;
    actor_email: string | null;
    actor_role: string | null;
    diff: { fields: string[]; changes?: Record<string, { from: unknown; to: unknown }> };
  }[];
};

const configured =
  adminEmail && adminPassword && sellerEmail && sellerPassword &&
  viewerEmail && viewerPassword && supabaseUrl && publishableKey;
const auditDescribe = configured ? test.describe : test.describe.skip;

auditDescribe("Historial (audit trail)", () => {
  test.describe.configure({ mode: "serial" });

  test("Seller: su cambio queda atribuido y no ve eventos de leads ajenos", async ({
    browser,
  }) => {
    const seller = await loggedInPage(browser, sellerEmail, sellerPassword);
    const admin = await loggedInPage(browser, adminEmail, adminPassword);
    try {
      const own = await leadIdByName(seller.page, "Seller Dos SL");
      const adminLead = await leadIdByName(admin.page, "Admin Uno SL");

      for (const status of ["Validado", "Nuevo"]) {
        const res = await seller.page.request.patch(`/api/leads/${own}`, {
          data: { status },
        });
        expect(res.status()).toBe(200);
      }
      const noteRes = await admin.page.request.patch(`/api/leads/${adminLead}`, {
        data: { notes: "texto-privado-e2e" },
      });
      expect(noteRes.status()).toBe(200);

      const ownHistory = (await (
        await seller.page.request.get(`/api/leads/${own}/history`)
      ).json()) as HistoryBody;
      const statusEvent = ownHistory.entries.find(
        (e) => e.action === "lead.status_changed",
      );
      expect(statusEvent?.actor_email).toBe(sellerEmail);
      expect(statusEvent?.actor_role).toBe("Seller");
      expect(statusEvent?.diff.changes?.status).toBeTruthy();

      const foreign = await seller.page.request.get(`/api/leads/${adminLead}/history`);
      expect(foreign.status()).toBe(200);
      expect(((await foreign.json()) as HistoryBody).entries).toHaveLength(0);

      const adminHistory = (await (
        await admin.page.request.get(`/api/leads/${adminLead}/history`)
      ).json()) as HistoryBody;
      const noteEvent = adminHistory.entries.find(
        (e) => e.action === "lead.note_edited",
      );
      expect(noteEvent?.diff.fields).toEqual(["notes"]);
      expect(noteEvent?.diff.changes).toBeUndefined();
      expect(JSON.stringify(adminHistory)).not.toContain("texto-privado-e2e");
    } finally {
      await seller.close();
      await admin.close();
    }
  });

  test("vista global solo Admin y login registrado", async ({ browser }) => {
    const admin = await loggedInPage(browser, adminEmail, adminPassword);
    const seller = await loggedInPage(browser, sellerEmail, sellerPassword);
    const viewer = await loggedInPage(browser, viewerEmail, viewerPassword);
    try {
      expect((await seller.page.request.get("/api/audit")).status()).toBe(403);
      expect((await viewer.page.request.get("/api/audit")).status()).toBe(403);

      const res = await admin.page.request.get("/api/audit?action=auth.login");
      expect(res.status()).toBe(200);
      const body = (await res.json()) as HistoryBody & { total: number };
      expect(body.total).toBeGreaterThan(0);
      expect(body.entries.every((e) => e.action === "auth.login")).toBe(true);
    } finally {
      await admin.close();
      await seller.close();
      await viewer.close();
    }
  });

  test("authenticated no puede insertar en audit_log por PostgREST", async ({
    request,
  }) => {
    const tokenRes = await request.post(
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        headers: { apikey: publishableKey },
        data: { email: adminEmail, password: adminPassword },
      },
    );
    expect(tokenRes.status()).toBe(200);
    const { access_token: token, user } = (await tokenRes.json()) as {
      access_token: string;
      user: { id: string };
    };

    const insert = await request.post(`${supabaseUrl}/rest/v1/audit_log`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
      data: {
        actor_id: user.id,
        action: "lead.updated",
        entity: "lead",
        entity_id: "forged",
        diff: {},
      },
    });
    expect([401, 403]).toContain(insert.status());

    const update = await request.patch(`${supabaseUrl}/rest/v1/audit_log?entity=eq.lead`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
      data: { entity_id: "x" },
    });
    expect([401, 403]).toContain(update.status());
  });
});
