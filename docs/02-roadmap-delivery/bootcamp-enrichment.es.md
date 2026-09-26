# Enriquecimiento del roadmap (temas del bootcamp)

Este documento **no sustituye** la secuencia canónica en
[`GDW_context.es.md`](./GDW_context.es.md) (EN: [`GDW_context.md`](./GDW_context.md)).
Los temas del bootcamp (telemetría, jobs, colas, caché, pipelines de KPIs)
sirven solo como **enriquecimiento opcional** adaptado al stack actual:
Next.js + Supabase + Vercel.

No es un gate de entrega. No clonar el monorepo FastAPI, Celery, Prefect o
Flower “porque el hito lo pide”: se toma la **idea**, no la herramienta.

## Cómo usarlo

- Marcar `[x]` cuando haya código + evidencia; `[ ]` si está pendiente.
- Etiquetas:
  - **Canónico** — ya definido en el roadmap GDW.
  - **Enriquecimiento** — inspirado en el bootcamp; opcional y priorizable.
- Stack de referencia: Vercel Cron / Supabase Cron / Edge Functions; jobs en
  Postgres; observabilidad con logs estructurados o Sentry. Cola/broker solo
  si la carga lo exige.

## Orden sugerido post go-live

1. [ ] Cerrar pendientes canónicos que siguen abiertos (CodeQL, audit trail). Secret scanning y push protection están activados. LICENSE, Dependabot y la validación zod de PATCH de leads ya están hechos.
2. [ ] Observabilidad mínima de producto (eventos). Los errores de UI y los logs JSON de ingesta/análisis ya cubren una parte (PR #54).
3. [ ] Jobs en background para sync / analyze IA.
4. [ ] Reporting de negocio (KPIs CRM) si Stats se queda corto.
5. [ ] Cola/offload (`202` + `job_id`) solo si los requests empiezan a bloquearse.

---

## M1 Seguro

Camino canónico: autenticación, invalidación de sesiones, rate limits, body
caps, cabeceras de seguridad, RLS por rol. Validación SaaS mínima: segundo
usuario sin ver leads ajenos.

### Canónico — hecho

- [x] Sesión verificada en rutas API sensibles (`requireApiSession`).
- [x] Auth email/password con Supabase Auth; perfiles + roles (`Admin` / `Seller` / `Viewer`).
- [x] RLS por rol en `leads` / `lead_activities`.
- [x] Rate-limit en memoria + topes de cuerpo (ingesta pública, análisis IA, demo enter; tope de cuerpo en PATCH masivo). El login de esta app no tiene rate-limit propio.
- [x] Cabeceras de seguridad (HSTS, CSP, frame/content-type/referrer/permissions).
- [x] `AUTH_DISABLED` fail-closed en producción.
- [x] Go-live interno mínimo (login prod, smoke Admin/Seller, ingest bearer).

### Canónico — pendiente

- [x] Validación `zod` en cuerpos PATCH (`PATCH /api/leads/:id` y PATCH masivo).
- [x] Higiene parcial: `LICENSE` MIT y Dependabot (npm y GitHub Actions; sin auto-merge). PR #43.
- Dependabot ignora las actualizaciones semver-major y agrupa las actualizaciones semanalmente.
- [x] Secret scanning y push protection activados.
- [ ] Higiene restante: CodeQL. El repo es público, así que el default setup de GitHub no exige Advanced Security; sigue sin workflow en el repo.
- [ ] Historial de auditoría (quién hizo qué) — especificado en
      [`audit-trail.es.md`](./audit-trail.es.md) (EN: [`audit-trail.md`](./audit-trail.md)).

### Enriquecimiento bootcamp

- [ ] Nada que desvíe el cierre de M1. El audit trail canónico cubre el
      “quién hizo qué” que el bootcamp trata en telemetría/auditoría de equipo.
      Implementar según el spec existente, no un segundo sistema paralelo.

---

## M2 Sólido

Camino canónico: más pruebas, gates de CI, observabilidad, gestión de errores
y documentación endurecida.

### Canónico

- [x] CI con lint, typecheck, unit, component y e2e (Playwright). M2 Slice 1 (2026-09-24): esos cuatro jobs son gates obligatorios en `master` (estricto, `enforce_admins` activo): Lint & TypeCheck, Unit Tests, Component Tests, E2E Tests. CodeQL no es check requerido; las revisiones requeridas no están por encima de 0.
- [ ] Ampliar cobertura de tests donde haya huecos reales (no vanity %).
- [x] Observabilidad parcial (PR #54, M2 Slice 2): `src/app/error.tsx` y `src/app/global-error.tsx`; una línea JSON en los catch de ingesta y análisis (`route`, `status`, `errorClass`, `requestId`) vía `src/lib/route-log.ts`. Sin Sentry ni eventos de producto.
- [x] Documentación operativa alineada con `master` (Supabase Auth, RBAC, slices M2, demo de visitante).

### Enriquecimiento bootcamp

- [ ] **Telemetría de aplicación** (idea Hito 20): eventos de producto y
      errores (login fallido, sync, analyze IA, ingest, latencias de APIs
      críticas). Sentry y/o tabla ligera. El reporte técnico **no** es el
      Dashboard/Stats de leads.
- [ ] **Jobs en segundo plano** (idea Hito 22): máquina de estados
      `pending → processing → completed|failed`, lock anti doble ejecución,
      idempotencia. Disparo con Vercel Cron o Supabase Cron. Candidatos:
      sync masivo, scoring/análisis IA por lote, export/digest.
- [ ] **Caché / rendimiento frontend** (ideas Hitos 18–19): Cache Components /
      revalidación, menos waterfalls en leads, payloads sin campos de más.
- [ ] **Resiliencia de integraciones**: reintentos con backoff y timeouts
      claros en n8n, Resend y Groq (fallar bien, no colgar el request).

---

## M3 SaaS comercial

Camino canónico: billing, automatización propia, realtime y escala.

### Canónico

- [ ] Billing / planes.
- [ ] Automatización propia (menos dependencia best-effort de n8n donde importe).
- [ ] Realtime donde aporte valor de producto.
- [ ] Capacidades de escala (límites, multi-tenant comercial si aplica).

### Enriquecimiento bootcamp

- [ ] **Offload de trabajo lento** (idea Hito 23): endpoint que encola y
      responde `202` + `job_id`; consulta de estado. Mensajes ligeros (ids, no
      blobs). Timeout por tarea.
- [ ] **Pipeline de reporting de negocio** (idea Hito 21): KPIs de CRM
      (conversión de estados, emails preparados/semana, tiempo en cola)
      separados de telemetría técnica. Tablas/vistas de reporting + job
      periódico; no mezclar con Stats “técnico”.
- [ ] **Cola / broker** solo si la carga lo exige: tabla `jobs` en Postgres,
      QStash, Inngest u similar. **No** adoptar Redis+Celery+Flower como
      default en Vercel.

---

## Fuera de alcance (no copiar literal)

- Inventario / ORM Python / doble base de datos del monorepo académico.
- Redis + Celery + Flower como stack por defecto.
- Ejercicios de colas de banco/triaje como producto (solo modelo mental de
  prioridades, p. ej. Daily Work).
- Sustituir la secuencia M1 → M2 → M3 de GDW por el temario del bootcamp.

## Relación con el contexto canónico

Cualquier ítem de enriquecimiento que se implemente debe:

1. Actualizar el código y, si cambia el producto, el `GDW_context` bilingüe.
2. Dejar evidencia (tests / smoke) antes de marcar `[x]`.
3. Seguir aislado en ramas (nunca trabajar directo en `main`/`master`).
