# Roadmap a joya SaaS v2 — GallaDev Workspace

> **Estado:** vigente · **Alcance:** plan de ejecución para llevar el proyecto de herramienta individual a SaaS completo.
> **Fuente de verdad de producto:** [`DECISIONES.md`](./DECISIONES.md) · **Fases v1/v2:** [`ROADMAP.md`](./ROADMAP.md) · **Contexto:** [`CONTEXTO_NEGOCIO.md`](./CONTEXTO_NEGOCIO.md)

> **Decisión operativa 2026-09-22:** el SaaS se construye sobre este mismo proyecto y repositorio. No crear una copia paralela. Las ramas/worktrees y los entornos separados sirven para aislar trabajo y datos, no para mantener dos productos.

## 1. Visión

GallaDev Workspace pasa de herramienta individual a **SaaS multi-usuario** para prospección de Clientes en general: Supabase (PostgreSQL) como fuente de verdad, roles, billing con Stripe y automatización propia → email (n8n queda como proveedor opcional, decisión #18). "Joya" = seguro por defecto, testeado con gates reales, documentado al día y operable (salud, errores, changelog).

## 2. Punto de partida (evidencia, 2026-09-17)

- **Sólido:** Next.js 16 + Supabase por defecto (`src/lib/repository/get-repository.ts`), CI con 4 jobs en verde, 326 unit tests, gobernanza mergeada (PR #24/#25: CONTRIBUTING EN/ES, Code of Conduct, Security, templates), dark mode + drawer móvil.
- **Grietas:**
  - 0/19 rutas API verifican sesión (`src/middleware.ts` es la única defensa; `isAuthDisabled()` abre todo si falta `AUTH_SECRET`).
  - RLS permisivo `USING(true)` (`supabase/migrations/20260913152449_init_leads.sql`) + `service_role` que lo bypasea (`src/lib/supabase/admin.ts`).
  - 19/19 rutas API sin tests; repositorios y auth sin tests; E2E = 4 smokes (`tests/e2e/critical-paths.spec.ts`); MSW cableado pero sin arrancar (`vitest.setup.ts`).
  - Cobertura sin thresholds (`vitest.config.mts`) y `fail_ci_if_error:false` en CI.
  - Docs con "Notion es la fuente de verdad" (`docs/architecture/ARQUITECTURA.md`, `INTEGRACIONES.md`, `ESTADO_IMPLEMENTACION.md`, `docs/guides/GUIA_USO.md`, `docs/README.md`).
  - Sin `LICENSE`, sin Sentry, sin `GET /api/health` (el middleware la excluye pero no existe), sin `error.tsx` / `not-found.tsx`.

## 2.1 Estrategia decidida

No se terminará primero una versión individual y después se copiará para convertirla en SaaS. Esa estrategia duplicaría el mantenimiento y provocaría divergencias entre el workspace y el SaaS.

La estrategia oficial es evolucionar la mejor versión de este proyecto en una sola línea de producto:

1. Cerrar el mínimo de seguridad que bloquea a un segundo usuario.
2. Validar el flujo SaaS mínimo con una persona real en un entorno controlado.
3. Endurecer tests, CI, observabilidad, errores y documentación.
4. Construir las funcionalidades comerciales y de escala que estén justificadas por la validación.

El trabajo se hará en ramas de Git. Si hace falta ejecutar dos versiones al mismo tiempo, se utilizará `git worktree` y un entorno de datos separado. No se harán copias manuales de la carpeta ni repositorios paralelos.

### Alcance de la primera validación SaaS

El objetivo inmediato no es construir todo el SaaS. Es demostrar este flujo:

`signup/login → leads → Kanban → email → cambio de estado`

La validación exige dos resultados simultáneos:

- el segundo usuario puede trabajar de extremo a extremo;
- no puede leer ni modificar leads que no le correspondan.

Stripe, planes, marketing automation, realtime avanzado y optimización para miles de filas quedan después de esta prueba. No son criterios para decidir si el producto debe continuar.

### Orden de ejecución para trabajo parcial

- **Paso 0:** integrar/cerrar los fixes ya abiertos de autenticación y Settings sin cambiar el alcance.
- **Paso 1 — M1 recortado:** `requireSession()` en APIs sensibles, `AUTH_SECRET` obligatorio en producción, RLS inicial por rol, headers, límites de payload y rate-limit básico.
- **Paso 2 — Slice SaaS:** autenticación multiusuario con Supabase Auth/JWT, perfil/rol, responsable o aislamiento de leads y flujo de segundo usuario.
- **Paso 3 — Validación:** probar con un segundo usuario en preview y documentar resultados, errores y decisiones.
- **Paso 4 — M2:** completar tests de rutas, cobertura, E2E, a11y, health check, manejo de errores, observabilidad y documentación.
- **Paso 5 — M3:** billing, cola interna, webhooks intercambiables, realtime, escala y operación.

### Puerta de avance

No se iniciará la Fase 4 completa de SaaS ni Stripe hasta que el flujo SaaS mínimo esté validado. Si el segundo usuario no puede completar el flujo o el aislamiento falla, se corrige la base técnica antes de añadir funcionalidades.

## 3. Fase 1 — Seguridad (~1–2 sem, prioridad)

Sin esto, multi-usuario y billing son inseguros por diseño.

| # | Tarea | Aceptación |
|---|-------|------------|
| 1.1 | ✅ `requireApiSession()` en 14 rutas sensibles (`leads`, `leads/[id]`, `duplicates`, `merge`, `score`, `pain-analysis`, `analyze`, `sync`, `settings`, `settings/status`, `settings/test`, `automations`, `automations/[action]`, `db-status`) + tests (`api-auth.test.ts`, rama `feat/m1-second-user`) | `AUTH_DISABLED=true` solo abre local; en prod sin sesión → 401. Tests de `login`/`logout`/`middleware` |
| 1.2 | ✅ Migración `20260922000000_roles_rls.sql`: enum `app_role`, tabla `profiles`, policies por rol en `leads`/`lead_activities` (rama `feat/m1-second-user`, **pendiente de aplicar en Supabase**) | `authenticated` sin rol no lee/escribe leads ajenos; proveedor (`leadsDbProvider`) intacto |
| 1.3 | ✅ Security headers (HSTS, CSP, X-Frame-Options, Content-Type, Referrer) en `next.config.ts` (rama `feat/m1-second-user`) | Verificado con `curl -I` en preview |
| 1.4 | 🟡 Rate-limit compartido (`src/lib/rate-limit.ts`) + body caps en ingest/login/PATCH bulk con tests (rama `feat/m1-second-user`). Pendiente: validación con `zod` (sustituir `as LeadPatch`) | 429 ante abuso; payloads gigantes rechazados; PATCH valida |
| 1.5 | ✅ Invalidación global de sesión (PR #31) + `AUTH_SECRET` obligatorio en prod + eliminado fallback `"auth-session-fallback"` (rama `feat/m1-second-user`, tests `auth.test.ts`) | Token pre-bump → 401 tras logout-all; logout normal no afecta a otras sesiones. Pendiente: expiración por usuario (hoy el epoch es global) |
| 1.6 | Higiene: `LICENSE`, secret scanning + push protection, Dependabot, CodeQL, branch protection en `master` (checks + up-to-date + squash, sin reviews en solo-dev) | Alertas activas; protección aplicada |

## 4. Fase 2 — Tests con gates reales (~2 sem)

| # | Tarea | Aceptación |
|---|-------|------------|
| 2.1 | Tests de las 19 rutas API (auth, validación, errores) + `SupabaseLeadRepository` + `get-repository` | Cobertura de rutas ≥80% |
| 2.2 | Arrancar MSW en `vitest.setup.ts` (`listen`/`reset`/`close`) | Mocks efectivos, sin drift |
| 2.3 | Thresholds 80/70 en `vitest.config.mts` + `fail_ci_if_error:true` + ampliar `include` (hoy solo 5 paths) | Un PR con cobertura baja falla |
| 2.4 | E2E reales: sync, drawer edit, kanban drag, merge, análisis IA, settings (con `data-testid`) | 6 paths + edge cases en CI |
| 2.5 | a11y: script `test:a11y` (axe), skip-link, `<main id="main">` único, checklist de `DESIGN_SYSTEM.md` | 0 violaciones axe |
| 2.6 | Endurecer `tsconfig` (`noUncheckedIndexedAccess`, `noUnusedLocals`/`noUnusedParameters`) + typecheck de `tests/`; `eslint --max-warnings=0` | `tsc` cubre tests; lint sin warnings |

## 5. Fase 3 — Acabado y docs (~1 sem)

| # | Tarea | Aceptación |
|---|-------|------------|
| 3.1 | Sincronizar docs obsoletos (Notion → Supabase): `ARQUITECTURA`, `INTEGRACIONES`, `ESTADO_IMPLEMENTACION`, `GUIA_USO`, `docs/README`, diagramas | `grep "Notion es la fuente" docs/` = 0 (salvo menciones legacy explícitas) |
| 3.2 | `error.tsx` / `global-error.tsx` / `not-found.tsx` / `loading.tsx` | Rutas rotas y fallos muestran UI propia |
| 3.3 | `GET /api/health` (app + latencia DB) + logging estructurado + Sentry | Todo error JS llega con traza |
| 3.4 | `CHANGELOG.md` (Keep-a-Changelog) + ADRs breves para decisiones v2 | Cada release documenta cambios |

## 6. Fase 4 — SaaS v2 (~4–6 sem, sobre roadmap existente)

1. NextAuth + Supabase JWT, routing protegido por rol (completa Fase 2 del `ROADMAP.md`).
2. Tags (chips + autocomplete) y Responsable (dropdown de usuarios) — Fase 3 del roadmap.
3. Stripe: planes Free/Pro/Enterprise + webhooks + UI de suscripción — Fase 3.
4. Cola interna de automatización (`work_queue`); webhooks `lead_created` / `status` / `tag` con proveedor intercambiable; realtime channels — Fase 4. n8n no es dependencia.
5. Auditoría mobile + WCAG 2.2 AA + virtualización/paginación de miles de filas — Fase 5.
6. Backup/restore de Supabase + runbook de operación + SLAs internos.

## 7. Hitos y definición de "joya"

- **M1 Seguro:** Fase 1 completa + `npm audit` limpio + sin secretos en historial.
- **M2 Sólido:** Fases 2–3; CI falla ante regresiones de cobertura/tests/a11y; docs sin contradicciones.
- **M3 SaaS:** Fase 4; un segundo usuario (rol Vendedor) opera end-to-end — signup → leads → kanban → email → billing — con trazas y sin acceso a datos ajenos.

## 8. Riesgos

- RLS mal modelada bloquea accesos legítimos → mitigación: suite de tests por rol antes de activar enforcement.
- Dependencia de n8n → mitigación aplicada: contrato de ingesta propio, vías sin n8n y dispatches best-effort (decisión #18); la Fase 4 construye cola interna en vez de más nodos n8n.
- Alcance: estimaciones en semanas solo-dev a ritmo parcial; recortar por hitos M1 → M3, nunca por calidad.
