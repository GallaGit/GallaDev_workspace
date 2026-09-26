# Historial Y Mantenimiento

## Sesiones históricas

Este contexto consolida las antiguas notas de sesiones fechadas. Las fechas conservan trazabilidad, pero las entradas son históricas y no sustituyen al código actual ni al comportamiento de Supabase.

### 2026-09-04: pasada de desarrollo

Registró la base de desarrollo, las decisiones de producto y la transición desde un workspace individual hacia una validación SaaS por hitos.

### 2026-09-12: corrección de modo oscuro

Registró la corrección del modo oscuro y la verificación visual necesaria después de cambiar el tema y el layout compartidos.

### 2026-09-12: filtros compactos de leads

Registró el trabajo de compactación de filtros de leads y el comportamiento responsive esperado en la pantalla Leads.

### Corte a Supabase (PR #30)

Notion dejó de ser la fuente de verdad en runtime. Los leads persisten solo en Supabase. El script de migración sigue en `docs/archive/` y no está cableado a scripts de npm.

### Supabase Auth (PR #37)

Email + contraseña sustituyó el login de contraseña compartida. `AUTH_SECRET`, `AUTH_PASSWORD`, `SESSION_TTL_DAYS`, la comprobación del epoch de sesión y `POST /api/auth/logout-all` no forman parte de la app. Un Admin crea los usuarios en el Dashboard de Supabase; `on_auth_user_created` asigna Seller. **Cerrar todas las sesiones** llama a `supabase.auth.signOut({ scope: "global" })`.

### RBAC (PR #44)

Las mutaciones de settings y automatizaciones son solo Admin. Las escrituras de leads y el análisis IA son Admin o Seller. Las escrituras de Viewer responden 403. `GET /api/team` es solo Admin.

### Slices de M2 (PR #53, PR #54)

Slice 1: Lint & TypeCheck, Unit Tests, Component Tests y E2E Tests son obligatorios en `master`. Slice 2: tests de ingesta 401/429/413, `error.tsx` / `global-error.tsx` y logs JSON de `src/lib/route-log.ts` (`route`, `status`, `errorClass`, `requestId`).

### Demo de visitante (PR #55)

Sesión de solo lectura sin contraseña (cookie httpOnly HMAC, apagada por defecto). `getSessionLeadRepository()` devuelve `DemoLeadRepository`. Las páginas `/settings`, `/automations` y `/email` redirigen a `/leads`; las APIs bloqueadas responden 403 `demo_readonly`.

## Política de archivo

Los scripts históricos se conservan solo cuando ayudan a explicar una migración o recuperación. `docs/archive/migrate-notion-to-supabase.mts` no forma parte del runtime y no debe conectarse a scripts de package sin una revisión deliberada.

## Reglas de mantenimiento

- Actualizar ambos archivos de idioma al cambiar el contexto canónico del producto.
- Separar el comportamiento actual de las decisiones históricas.
- No tratar `docs/archive/diagrams-notion-era/` como arquitectura actual (sigue mostrando Notion y `src/middleware.ts`). Describir el camino vivo en `docs/03-architecture-integrations/` en vez de copiar ese diagrama.
- No guardar secretos, tokens ni datos de producción en la documentación.
