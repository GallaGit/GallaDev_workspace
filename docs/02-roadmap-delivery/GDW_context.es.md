# Roadmap Y Entrega

## Secuencia de entrega

- **M1 Seguro:** autenticación, invalidación de sesiones, límites de tasa, límites de cuerpo, cabeceras de seguridad y aislamiento por filas.
- **Validación SaaS mínima:** un segundo usuario completa el flujo principal sin ver leads ajenos.
- **M2 Sólido:** más pruebas, gates de CI, observabilidad, gestión de errores y documentación endurecida.
- **M3 SaaS comercial:** billing, automatización propia, realtime y capacidades de escala.

Enriquecimiento opcional (checklist) desde temas del bootcamp — no sustituye esta secuencia: [`bootcamp-enrichment.es.md`](./bootcamp-enrichment.es.md).

## Estado actual

Supabase es la capa de persistencia activa y la única fuente de verdad. La aplicación actual incluye leads, Kanban, email, Daily Work, estadísticas, duplicados, settings, base de autenticación, endpoints de ingesta y análisis IA. Las integraciones con n8n son opcionales y best-effort.

### Base de seguridad M1 (2026-09-22)

- Verificación explícita de sesión en 14 rutas API sensibles (`requireApiSession`; 401 sin sesión en producción).
- `AUTH_SECRET` obligatorio en producción; sin secreto de fallback.
- Cabeceras de seguridad (HSTS, CSP, frame/content-type/referrer/permissions).
- Rate-limit compartido en memoria + topes de cuerpo en ingesta, login y PATCH masivo.
- Migración RLS por rol aplicada en Supabase (`app_role`: Admin/Seller/Viewer; tabla `profiles`; policies por rol en `leads`/`lead_activities`).
- Validación con `zod` en cuerpos PATCH de leads (`PATCH /api/leads/:id` y PATCH masivo).
- Higiene hecha: `LICENSE` MIT y Dependabot (npm y GitHub Actions; abre PRs, no los fusiona).
- Pendiente de M1: secret scanning y CodeQL.

### Cierre M1 / post-M1 en prod (2026-09-24)

Producción: `https://workspace.galladev.com`. `GET /api/health` responde `{"ok":true}` (el proceso atiende HTTP; sin sesión ni base de datos).

- **RBAC High** (PR #44): mutaciones de settings y automatizaciones solo Admin; escrituras de leads y análisis IA para Admin o Seller; Viewer recibe 403 en escrituras. `GET /api/team` solo Admin. El análisis IA usa la sesión autenticada (RLS), no `service_role` en las peticiones normales, con tope de 10 peticiones / 60s. La UI se guía por el rol de la sesión.
- **Kanban, Statistics e higiene de release** (PR #43): eliminado el “+ añadir tarjeta” del Kanban (no persistía); selector de tipo de gráfico en Statistics (barras / donut / área); `GET /api/health`; `LICENSE` MIT; Dependabot.
- **M2 Slice 1 — gates de CI en `master`:** obligatorios y estrictos, con `enforce_admins` activo: Lint & TypeCheck, Unit Tests, Component Tests, E2E Tests. CodeQL no es check obligatorio. Las revisiones requeridas no están por encima de 0.

### Planificado: historial de auditoría (especificado, no implementado)

El quién-hizo-qué para trabajo en equipo está especificado en
[`audit-trail.es.md`](./audit-trail.es.md) (EN: [`audit-trail.md`](./audit-trail.md)).
Prerrequisito: identidad por usuario del Paso 2; la implementación llega
después de la validación con el segundo usuario.

## Reglas de entrega

El trabajo se aísla con ramas y entornos, no con copias del repositorio. Los cambios de producto deben actualizar el contexto canónico y mantenerse alineados con el código y el esquema de base de datos. Los informes históricos de verificación son evidencias de su fecha, no garantías sobre el build actual.

## Evidencia de aceptación

Antes de marcar un hito como completado, hay que verificar lint, TypeScript, tests unitarios, tests de componentes, build, autenticación y RLS según corresponda. Los fallos y supuestos del entorno deben registrarse explícitamente. Ningún elemento futuro del roadmap debe presentarse como comportamiento actual sin código y evidencia de verificación.
