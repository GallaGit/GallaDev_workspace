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
- Merge a `master`: PR #37 (`feat/saas-slice`). Fix E2E CI: PR #38.

## 2026-09-23 — Diagnóstico login local + fix cliente

### Síntoma
- UI mostraba «Error de red» / «Credenciales incorrectas» tras recrear usuarios.
- `last_sign_in_at` era `null` (nunca habían entrado con éxito desde la app).

### Hallazgos
- Usuarios Admin y Seller existían con perfil y `email_confirmed_at`.
- Password grant Admin + `AUTH_PASSWORD` (env local) → OK en Auth API.
- Seller → `invalid_credentials` con esa misma password → se alineó password del Seller vía Admin API. Identidades email marcadas `email_verified=true`.
- Root cause UI: `src/lib/supabase/env.ts` leía `process.env[key]` de forma dinámica; Next/Turbopack no inyecta `NEXT_PUBLIC_*` así en el browser → throw → catch «Error de red».

### Fix
- `env.ts`: acceso estático a `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `login-form.tsx`: mensajes de error más específicos.
- Verificado en browser local: login Admin → Dashboard.

## 2026-09-23 — Go-live mínimo (completado)

### Paso 0 — Memory bank
- Creada carpeta `memory_bank/` y este `SESSION_LOG.md`.

### Paso 1 — Commit fix login + merge
- Commit `5c3d0c7` en `fix/e2e-ci-supabase-auth`.
- PR #39: https://github.com/GallaGit/GallaDev_workspace/pull/39 — CI verde → **merged** (`9995d64`).
- Deploy Production Vercel listo (~1 min), alias `https://workspace.galladev.com`.

### Paso 2 — Variables Vercel Production
- Confirmadas presentes: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL`, `INGEST_SECRET`.
- **Eliminado** `AUTH_DISABLED` del entorno Production (sigue fail-closed por `NODE_ENV` si volviera a añadirse).
- Opcionales ya presentes: Groq, Resend, n8n webhooks.

### Paso 3 — Supabase Auth URLs
- Dashboard Auth URL config requiere login humano (MCP/browser sin sesión).
- Flujo crítico email/password en prod verificado (no depende de OAuth redirects).
- Valores esperados a revisar en Dashboard → Authentication → URL Configuration:
  - Site URL: `https://workspace.galladev.com`
  - Redirect allow list: `https://workspace.galladev.com/**`, `http://localhost:3000/**`

### Paso 4 — Smoke producción
- Login Admin en `workspace.galladev.com` → Dashboard con leads (OK).
- Logout → login Seller (OK).
- RLS: Admin JWT ve más leads que Seller cuando hay `responsable` = Admin (Seller 29 vs Admin 30 en probe).
- Ingest: bearer incorrecto → 401; bearer `INGEST_SECRET` → 201; lead de smoke eliminado tras la prueba.
- Logout Seller OK.

### Residual post-go-live (no bloqueante)
- zod en PATCH, audit trail, LICENSE / Dependabot / CodeQL (backlog M1/M2).

## 2026-09-23 — Roadmap enriquecido por bootcamp (docs)

- Rama `docs/bootcamp-enrichment-checklist` (fuera de master).
- Nuevo checklist: `docs/02-roadmap-delivery/bootcamp-enrichment.es.md` (M1/M2/M3 canónico + enriquecimiento; no sustituye GDW).
- Enlace de una línea en `GDW_context.es.md` y `GDW_context.md`.
- PR abierto a master (sin merge automático): https://github.com/GallaGit/GallaDev_workspace/pull/41

## 2026-09-24 — Validación zod en PATCH de leads

- `PATCH /api/leads/:id` y `PATCH /api/leads` (masivo) validan el cuerpo con zod (`validateLeadPatch` / `validateBulkLeadPatch`).
- Campos y reglas alineados con `LeadPatch` y con `validateLeadCreate` cuando el campo viene en el cuerpo. Un PATCH válido se persiste sin reescribir el valor.
- Cuerpo inválido → 400 `{ error, fieldErrors }` («Datos del lead no válidos»). JSON malformado en el PATCH individual → 400 «JSON no válido». El masivo conserva «ids y patch requeridos» si faltan `ids` o `patch`, y «Payload no válido o demasiado grande» si el JSON no parsea.
- Eliminado el cast `as LeadPatch` en esas rutas.
- Tests unitarios del validador y de las dos rutas PATCH.

## 2026-09-24 — RBAC en settings, leads, IA y equipo

- Mutaciones de settings y automatizaciones (`PATCH /api/settings`, `POST /api/settings/test`, `PATCH|POST /api/automations/:action`) exigen rol Admin. Lectura sigue abierta a cualquier sesión.
- Escrituras de leads (crear, PATCH individual y masivo, archivar, fusionar, puntuar) y análisis IA exigen Admin o Seller. Viewer recibe 403. La UI oculta o desactiva esas acciones.
- `POST /api/leads/:id/analyze` y `POST /api/leads/pain-analysis` comparten un rate-limit en memoria (`isRateLimited`, namespace `ai:analyze`, 10 peticiones / 60s por id de usuario). `runLeadAnalyze` ya no cae al repositorio service_role: el fallback es la sesión (RLS).
- `GET /api/team` solo Admin (antes cualquier sesión listaba perfiles y emails vía service_role). `GET /api/session` expone el rol propio para la UI.
- Sin secretos en este registro.

## 2026-09-24 — Quitar “Añadir tarjeta” del Kanban

### Decisión (Ociel)
- El control “+ Añadir tarjeta” abría un compositor local y no persistía el lead.
- Se elimina la opción. Alta de leads sigue por formulario de landing / n8n / UI formal de nuevo lead, si existe.
- No se conecta ese control a `createLead`. Independiente del PATCH con zod (PR #42).

### Cambio
- Eliminados el botón, el compositor y el atajo de ids `temp-` en `src/components/kanban/kanban-board.tsx`.
- El gate de escritura de #44 se mantiene: sin permiso no se arrastra ni se hace PATCH. El control de añadir no vuelve ni para quien puede escribir.
- Arrastrar una tarjeta existente entre columnas sigue haciendo `PATCH /api/leads/:id` con el nuevo estado.
- Test de componente: no hay affordance de añadir, y el drop sigue cambiando el estado.
- PR: https://github.com/GallaGit/GallaDev_workspace/pull/43
