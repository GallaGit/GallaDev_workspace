# Historial De Auditoría (Quién Hizo Qué) — Requisito Futuro

> **Estado:** especificado, no implementado · **Actualizado:** 2026-09-25
> **Prerrequisito:** cumplido. La identidad por usuario existe (Supabase Auth
> email + contraseña, `profiles.role` Admin / Seller / Viewer, PR #37 y #44).
> El registro de auditoría en sí sigue sin implementarse. No presentar como
> comportamiento actual: las mutaciones no se escriben en `audit_log`.

## 1. Objetivo

Con más de un usuario en el workspace debe poder responderse "quién hizo
qué, cuándo": cambios de estado, notas, emails, archivados, fusiones,
análisis IA, reasignaciones, cambios de settings y logins. Es un requisito
operativo y de confianza para el trabajo en equipo, y precondición para
cualquier futura facturación o reporte por usuario.

## 2. Alcance (cuando se implemente)

Por evento se registra:

- **actor**: `auth.users.id` + email + rol en el momento del evento
- **acción**: p. ej. `lead.status_changed`, `lead.note_edited`,
  `lead.email_marked`, `lead.archived`, `lead.merged`,
  `lead.ai_analyzed`, `lead.reassigned`, `settings.changed`,
  `auth.login`, `auth.logout`
- **entidad**: tabla + id de fila (id del lead, etc.)
- **antes/después**: diff mínimo (valor viejo → valor nuevo), nunca secretos
- **cuándo**: timestamp de servidor

Fuera de la primera versión: feed en tiempo real, exportación, políticas
de retención más allá de un default documentado, y UI de alcance por
organización (ver §5).

## 3. Diseño previsto

- Nueva tabla `public.audit_log` (solo inserción; sin policies de
  UPDATE/DELETE para roles de app, escrituras solo desde servidor).
- Columnas: `actor_id uuid REFERENCES auth.users(id)`,
  `actor_email text`, `actor_role app_role`, `action text`,
  `entity_table text`, `entity_id uuid`, `diff jsonb`,
  `org_id uuid NULL` (reservado para futuro multi-empresa; ver §5),
  `created_at timestamptz DEFAULT now()`.
- RLS: Admin lee todo; Seller/Viewer leen eventos de leads visibles
  para ellos (misma regla de visibilidad que `leads`); nadie edita.
- Las escrituras ocurren en las rutas API tras una mutación exitosa,
  usando el usuario de sesión de `requireApiSession` (nunca un actor
  enviado por el cliente). Lecturas fail-open, escrituras fail-closed:
  un fallo de log no debe tumbar la mutación de negocio en silencio,
  pero debe quedar registrado (log estructurado + Sentry cuando exista).
- UI: entrada en la timeline del lead ("quién hizo qué") reutilizando
  la timeline de actividad existente, más vista global solo-Admin con
  filtros (actor, acción, rango de fechas). Sin sistema de diseño nuevo;
  listas compactas como en el resto.

## 4. Criterios de aceptación (futuros)

- Cada mutación del §2 crea exactamente una fila en `audit_log` con
  actor correcto, incluyendo PATCH masivo y merge.
- Un Admin lista eventos por actor/acción/fecha; un Seller no ve
  eventos de leads fuera de su visibilidad.
- Escrituras directas a `audit_log` vía PostgREST con clave de rol de
  app son rechazadas (solo-inserción enforced por RLS).
- Tests automatizados cubren atribución en cambio de estado, edición
  de nota y reasignación.

## 5. Nota multi-empresa

Si el workspace sirve alguna vez a empresas externas, `org_id` delimita
eventos por organización (Modelo A: base compartida + columna tenant) o
cada empresa lleva su propio `audit_log` en su base (Modelo B: un proyecto
por empresa, mismas migraciones). Sin decisión por ahora; la columna
nullable deja ambos caminos abiertos.
