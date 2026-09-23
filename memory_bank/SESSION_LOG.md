# Session log — GallaDev Workspace

Diario operativo de trabajo. No sustituye `docs/` (contexto canónico GDW).  
**No escribir secretos, contraseñas ni claves** — solo nombres de variables y hechos.

---

## 2026-09-22 — Cutover Auth / SaaS slice

- Persistencia: Supabase como fuente de verdad de leads.
- Auth: email + password vía Supabase Auth (cuentas creadas en Dashboard → Users).
- Perfiles: trigger `on_auth_user_created` asigna rol por defecto `Seller`; Admin se marca a mano en `public.profiles`.
- RLS por rol (`Admin` / `Seller` / `Viewer`) en migraciones `20260922000000_*` y `20260922000001_*`.
- `AUTH_DISABLED`: solo efectivo en desarrollo; en producción fail-closed (`NODE_ENV=production` → auth siempre activa).
- Merge a `master`: PR #37 (`feat/saas-slice`). Fix E2E CI: PR relacionado en `fix/e2e-ci-supabase-auth`.

## 2026-09-23 — Diagnóstico login local + fix cliente

### Síntoma
- UI mostraba «Error de red» / «Credenciales incorrectas» tras recrear usuarios.
- `last_sign_in_at` era `null` (nunca habían entrado con éxito desde la app).

### Hallazgos
- Usuarios `ociel.galla@gmail.com` (Admin) y `ociel5996@gmail.com` (Seller) existían con perfil y `email_confirmed_at`.
- Password grant Admin + `AUTH_PASSWORD` (env local) → OK en Auth API.
- Seller → `invalid_credentials` con esa misma password → se alineó password del Seller vía Admin API (mismo valor que `AUTH_PASSWORD` local). Identidades email marcadas `email_verified=true`.
- Root cause UI: [`src/lib/supabase/env.ts`](../src/lib/supabase/env.ts) leía `process.env[key]` de forma dinámica; Next/Turbopack no inyecta `NEXT_PUBLIC_*` así en el browser → throw (`process is not defined`) → catch «Error de red».

### Fix (pendiente de merge al iniciar este go-live)
- `env.ts`: acceso estático a `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (y fallbacks).
- `login-form.tsx`: mensajes de error algo más específicos.
- Verificado en browser local: login Admin → Dashboard (`http://localhost:3000/`).

## 2026-09-23 — Go-live mínimo (en curso)

Estado al abrir este log: login local OK; falta commit/PR del fix, env Vercel, URLs Auth, smoke prod.

### Paso 0 — Memory bank
- Creada carpeta `memory_bank/` y este `SESSION_LOG.md`.
