# Roadmap a joya SaaS v2 — GallaDev Workspace

> **Estado:** vigente · **Alcance:** plan de ejecución para llevar el proyecto de herramienta individual a SaaS completo.
> **Fuente de verdad de producto:** [`DECISIONES.md`](./DECISIONES.md) · **Fases v1/v2:** [`ROADMAP.md`](./ROADMAP.md) · **Contexto:** [`CONTEXTO_NEGOCIO.md`](./CONTEXTO_NEGOCIO.md)

## 1. Visión

GallaDev Workspace pasa de herramienta individual a **SaaS multi-usuario** para prospección de asesorías y gestorías: Supabase (PostgreSQL) como fuente de verdad, roles, billing con Stripe y automatización n8n → email. "Joya" = seguro por defecto, testeado con gates reales, documentado al día y operable (salud, errores, changelog).

## 2. Punto de partida (evidencia, 2026-09-17)

- **Sólido:** Next.js 16 + Supabase por defecto (`src/lib/repository/get-repository.ts`), CI con 4 jobs en verde, 326 unit tests, gobernanza mergeada (PR #24/#25: CONTRIBUTING EN/ES, Code of Conduct, Security, templates), dark mode + drawer móvil.
- **Grietas:**
  - 0/19 rutas API verifican sesión (`src/middleware.ts` es la única defensa; `isAuthDisabled()` abre todo si falta `AUTH_SECRET`).
  - RLS permisivo `USING(true)` (`supabase/migrations/20260913152449_init_leads.sql`) + `service_role` que lo bypasea (`src/lib/supabase/admin.ts`).
  - 19/19 rutas API sin tests; repositorios y auth sin tests; E2E = 4 smokes (`tests/e2e/critical-paths.spec.ts`); MSW cableado pero sin arrancar (`vitest.setup.ts`).
  - Cobertura sin thresholds (`vitest.config.mts`) y `fail_ci_if_error:false` en CI.
  - Docs con "Notion es la fuente de verdad" (`docs/architecture/ARQUITECTURA.md`, `INTEGRACIONES.md`, `ESTADO_IMPLEMENTACION.md`, `docs/guides/GUIA_USO.md`, `docs/README.md`).
  - Sin `LICENSE`, sin Sentry, sin `GET /api/health` (el middleware la excluye pero no existe), sin `error.tsx` / `not-found.tsx`.

## 3. Fase 1 — Seguridad (~1–2 sem, prioridad)

Sin esto, multi-usuario y billing son inseguros por diseño.

| # | Tarea | Aceptación |
|---|-------|------------|
| 1.1 | `requireSession()` en rutas sensibles (`leads`, `leads/[id]`, `sync`, `settings`, `automations`, `db-status`) + tests | `AUTH_DISABLED=true` solo abre local; en prod sin sesión → 401. Tests de `login`/`logout`/`middleware` |
| 1.2 | RLS por rol (Admin/Vendedor/Viewer) + migración; reducir `service_role` a operaciones de servidor justificadas | `authenticated` sin rol no lee/escribe leads ajenos; proveedor (`leadsDbProvider`) intacto |
| 1.3 | Security headers (HSTS, CSP, X-Frame-Options, Content-Type, Referrer) en `next.config.ts` | Verificado con `curl -I` en preview |
| 1.4 | Rate-limit global + body caps + validación con `zod` (sustituir `as LeadPatch`) | 429 ante abuso; payloads gigantes rechazados; PATCH valida |
| 1.5 | Invalidación de sesión al logout + exigir `AUTH_SECRET` en prod (eliminar fallback `"auth-session-fallback"`) | Token post-logout → 401 |
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
4. Migración de nodos n8n Notion → Supabase; webhooks `lead_created` / `status` / `tag`; realtime channels — Fase 4.
5. Auditoría mobile + WCAG 2.2 AA + virtualización/paginación de miles de filas — Fase 5.
6. Backup/restore de Supabase + runbook de operación + SLAs internos.

## 7. Hitos y definición de "joya"

- **M1 Seguro:** Fase 1 completa + `npm audit` limpio + sin secretos en historial.
- **M2 Sólido:** Fases 2–3; CI falla ante regresiones de cobertura/tests/a11y; docs sin contradicciones.
- **M3 SaaS:** Fase 4; un segundo usuario (rol Vendedor) opera end-to-end — signup → leads → kanban → email → billing — con trazas y sin acceso a datos ajenos.

## 8. Riesgos

- RLS mal modelada bloquea accesos legítimos → mitigación: suite de tests por rol antes de activar enforcement.
- Migración n8n rompe captación → mitigación: run paralelo Notion + Supabase 2 semanas (ya previsto en roadmap).
- Alcance: estimaciones en semanas solo-dev a ritmo parcial; recortar por hitos M1 → M3, nunca por calidad.
