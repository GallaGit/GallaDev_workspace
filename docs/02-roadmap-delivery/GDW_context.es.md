# Roadmap Y Entrega

## Secuencia de entrega

- **M1 Seguro:** autenticación, invalidación de sesiones, límites de tasa, límites de cuerpo, cabeceras de seguridad y aislamiento por filas.
- **Validación SaaS mínima:** un segundo usuario completa el flujo principal sin ver leads ajenos.
- **M2 Sólido:** más pruebas, gates de CI, observabilidad, gestión de errores y documentación endurecida.
- **M3 SaaS comercial:** billing, automatización propia, realtime y capacidades de escala.

Enriquecimiento opcional (checklist) desde temas del bootcamp — no sustituye esta secuencia: [`bootcamp-enrichment.es.md`](./bootcamp-enrichment.es.md).

## Estado actual

Supabase es la capa de persistencia activa y la única fuente de verdad. La aplicación actual incluye leads, Kanban, email, Daily Work, estadísticas, duplicados, settings, Supabase Auth con RBAC (Admin, Seller, Viewer), endpoints de ingesta y análisis IA. Las integraciones con n8n son opcionales y best-effort. No hay alta pública.

### Base de seguridad M1 (2026-09-22)

- Verificación explícita de sesión en rutas API sensibles (`requireApiSession`; 401 sin sesión en producción).
- **Sustituido (PR #37):** «`AUTH_SECRET` obligatorio en producción» ya no aplica. El acceso es Supabase Auth (email + contraseña). `AUTH_SECRET`, `AUTH_PASSWORD` y `SESSION_TTL_DAYS` no se leen. `AUTH_DISABLED` es fail-closed en producción.
- Cabeceras de seguridad (HSTS, CSP, frame/content-type/referrer/permissions).
- Rate-limit compartido en memoria en la ingesta pública, el análisis IA (10 / 60s por usuario) y `POST /api/demo/enter` (8 / 15 min por IP), más topes de cuerpo en ingesta y PATCH masivo. El login no tiene rate-limit en esta app. El limitador es por instancia, no distribuido.
- Migración RLS por rol aplicada en Supabase (`app_role`: Admin/Seller/Viewer; `profiles.role`; policies por rol en `leads`/`lead_activities`).
- Validación con `zod` en cuerpos PATCH de leads (`PATCH /api/leads/:id` y PATCH masivo).
- Higiene hecha: `LICENSE` MIT, Dependabot (npm y GitHub Actions; abre PRs, no los fusiona) y secret scanning con push protection (activados).
- Higiene M1 que queda: **solo CodeQL**. El repositorio es público, así que el CodeQL default setup de GitHub no exige Advanced Security. Sigue sin haber workflow de CodeQL, y CodeQL no es un status check obligatorio.

### Cierre M1 / post-M1 en prod (2026-09-24)

Producción: `https://workspace.galladev.com`. `GET /api/health` responde `{"ok":true}` (el proceso atiende HTTP; sin sesión ni base de datos).

- **RBAC High** (PR #44): mutaciones de settings y automatizaciones solo Admin; escrituras de leads y análisis IA para Admin o Seller; Viewer recibe 403 en escrituras. `GET /api/team` solo Admin. El análisis IA usa la sesión autenticada (RLS), no `service_role` en las peticiones normales, con tope de 10 peticiones / 60s. La UI se guía por el rol de la sesión.
- **Kanban, Statistics e higiene de release** (PR #43): eliminado el “+ añadir tarjeta” del Kanban (no persistía); selector de tipo de gráfico en Statistics (barras / donut / área); `GET /api/health`; `LICENSE` MIT; Dependabot.
- **M2 Slice 1 — gates de CI en `master` (PR #53):** obligatorios y estrictos, con `enforce_admins` activo: Lint & TypeCheck, Unit Tests, Component Tests, E2E Tests. CodeQL no es check obligatorio. Las revisiones requeridas no están por encima de 0.

### M2 Slice 2 (PR #54, hecho)

- Tests de ingesta de `POST /api/ingest/lead` y `POST /api/ingest/n8n`: 401 sin bearer válido, 429 del limitador en memoria, 413 si el cuerpo supera el tope.
- `src/app/error.tsx` y `src/app/global-error.tsx` (reintentar / inicio). No hay SDK de Sentry en el repo.
- Logs estructurados vía `src/lib/route-log.ts` en los catch de ingesta y análisis: campos JSON `route`, `status` cuando se informa, `errorClass`, `requestId` si ya venía un id de cabecera válido.

### Demo de visitante (PR #55, hecha, 2026-09-25)

Demo sin contraseña para reclutadores y revisores. `DEMO_MODE_ENABLED` queda **apagado** si no está definido. Con `true` o `1` y `DEMO_SESSION_SECRET` (al menos 16 caracteres), el login ofrece «Entrar como visitante». Una cookie httpOnly firmada con HMAC (4 horas) se resuelve en servidor, por `getSessionLeadRepository()`, a `DemoLeadRepository` (leads ficticios en memoria). Las peticiones del visitante no construyen el cliente de sesión de Supabase ni el repositorio con service role. Las páginas `/settings`, `/automations` y `/email` redirigen a `/leads`. Las APIs bloqueadas responden 403 `demo_readonly`. `POST /api/demo/enter` responde 404 `demo_disabled`, 503 `demo_misconfigured` o 429. `GET /api/session` devuelve `visitor: true`. Unos pocos leads traen un análisis de dolores ya escrito. Para apagarla: `DEMO_MODE_ENABLED=false` o borrar la variable (sin cambio de código). Ver la guía de operación.

### Pendiente de M2

- **CodeQL** (también el último ítem de higiene de M1). No es check obligatorio. Repo público: el default setup no necesita Advanced Security.
- **Tests E2E de Viewer (403).** Las credenciales E2E de CI son solo Admin y Seller (`E2E_ADMIN_*`, `E2E_SELLER_*`, más `E2E_TEST_*`). No hay secreto de Viewer, así que los 403 de escritura los cubren tests unitarios (`src/lib/auth/rbac-routes.test.ts`) y no Playwright.
- **Rate limiting distribuido.** `src/lib/rate-limit.ts` es un mapa en memoria por instancia. No se comparte entre instancias serverless.
- **Historial de auditoría.** Especificado, no implementado. Ver abajo.

### Planificado: historial de auditoría (especificado, no implementado)

El quién-hizo-qué para trabajo en equipo está especificado en
[`audit-trail.es.md`](./audit-trail.es.md) (EN: [`audit-trail.md`](./audit-trail.md)).
La identidad por usuario (Supabase Auth + `profiles.role`) ya existe. El
registro de auditoría en sí, no. No tratarlo como comportamiento actual.

## Reglas de entrega

El trabajo se aísla con ramas y entornos, no con copias del repositorio. Los cambios de producto deben actualizar el contexto canónico y mantenerse alineados con el código y el esquema de base de datos. Los informes históricos de verificación son evidencias de su fecha, no garantías sobre el build actual.

## Evidencia de aceptación

Antes de marcar un hito como completado, hay que verificar lint, TypeScript, tests unitarios, tests de componentes, build, autenticación y RLS según corresponda. Los fallos y supuestos del entorno deben registrarse explícitamente. Ningún elemento futuro del roadmap debe presentarse como comportamiento actual sin código y evidencia de verificación.
