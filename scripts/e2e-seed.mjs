#!/usr/bin/env node
/**
 * Siembra el Supabase LOCAL del E2E: usuarios fake Admin/Seller/Viewer con su
 * rol en public.profiles y unos leads de prueba. Idempotente.
 *
 * Necesita SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (los imprime
 * `supabase status`) y las credenciales E2E_*_EMAIL / E2E_*_PASSWORD.
 * Se niega a correr contra una URL que no sea local para no tocar nunca
 * un proyecto real.
 */
import { createClient } from "@supabase/supabase-js";

const url = (process.env.SUPABASE_URL ?? "").trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

function fail(msg) {
  console.error(`e2e-seed: ${msg}`);
  process.exit(1);
}

if (!url || !serviceKey) fail("faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url)) {
  fail(`${url} no es un Supabase local; abortando para no tocar datos reales`);
}

const users = [
  { key: "ADMIN", role: "Admin" },
  { key: "SELLER", role: "Seller" },
  { key: "VIEWER", role: "Viewer" },
].map((u) => ({
  ...u,
  email: (process.env[`E2E_${u.key}_EMAIL`] ?? "").trim(),
  password: (process.env[`E2E_${u.key}_PASSWORD`] ?? "").trim(),
}));
for (const u of users) {
  if (!u.email || !u.password) fail(`faltan E2E_${u.key}_EMAIL / E2E_${u.key}_PASSWORD`);
}

const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function ensureUser(u) {
  const { data, error } = await sb.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
  });
  if (error) {
    const { data: list, error: listErr } = await sb.auth.admin.listUsers({ perPage: 200 });
    if (listErr) fail(`listUsers: ${listErr.message}`);
    const found = list.users.find((x) => x.email === u.email);
    if (!found) fail(`createUser ${u.email}: ${error.message}`);
    return found.id;
  }
  return data.user.id;
}

const ids = {};
for (const u of users) {
  ids[u.key] = await ensureUser(u);
  const { error } = await sb
    .from("profiles")
    .upsert({ id: ids[u.key], role: u.role }, { onConflict: "id" });
  if (error) fail(`profiles ${u.role}: ${error.message}`);
}

// 3 del Seller, 2 sin responsable y 1 del Admin: el Seller solo ve los suyos
// (RLS), el Admin ve los 6. tests/e2e/auth-sync-roles.spec.ts depende de esto.
const leads = [
  ["Seller Uno SL", ids.SELLER],
  ["Seller Dos SL", ids.SELLER],
  ["Seller Tres SL", ids.SELLER],
  ["Sin asignar Uno SL", null],
  ["Sin asignar Dos SL", null],
  ["Admin Uno SL", ids.ADMIN],
].map(([company_name, responsable], i) => ({
  notion_page_id: `e2e-seed-${i + 1}`,
  company_name,
  responsable,
  email: `contacto${i + 1}@e2e.test`,
  city: "Madrid",
  province: "Madrid",
  status: "Nuevo",
}));

const { error: leadsErr } = await sb
  .from("leads")
  .upsert(leads, { onConflict: "notion_page_id" });
if (leadsErr) fail(`leads: ${leadsErr.message}`);

console.log(`e2e-seed: ${users.length} usuarios y ${leads.length} leads listos`);
