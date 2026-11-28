# Historial De Auditoría (Quién Hizo Qué)

> **Estado:** implementado parcialmente (primera entrega) · **Actualizado:** 2026-11-28
> **Migraciones:** `20261024120000_audit_log.sql` (tabla) y
> `20261128120000_audit_log_hardening.sql` (solidez, columnas y RLS).
> Ociel las aplica a mano en producción.
> **Pendiente (segunda entrega):** Correo, fusiones de leads y análisis IA
> (ver §6).

## 1. Objetivo

Con más de un usuario en el workspace debe poder responderse "quién hizo
qué, cuándo": cambios de estado, notas, emails, archivados, fusiones,
análisis IA, reasignaciones, cambios de ajustes y logins. Es un requisito
operativo y de confianza para el trabajo en equipo, y precondición para
cualquier futura facturación o reporte por usuario.

## 2. Qué se registra hoy (primera entrega)

| Acción (`action`) | Origen | Diff |
| --- | --- | --- |
| `lead.created` | `POST /api/leads` | nombres de campo |
| `lead.status_changed` | `PATCH /api/leads/:id` y `PATCH /api/leads` (masivo) | estado antes→después |
| `lead.reassigned` | ídem | responsable antes→después |
| `lead.note_edited` | ídem (`notes`/`notesOverflow`) | solo nombre del campo |
| `lead.updated` | ídem (resto de campos) | seguros antes→después; resto, solo nombre |
| `lead.archived` | `DELETE /api/leads/:id` | `["archived"]` |
| `team.role_changed` | `PATCH /api/team` | rol antes→después |
| `settings.changed` | `PATCH /api/settings` | `ai.provider` y `ai.model` antes→después; claves API solo por nombre |
| `auth.login` | `POST /api/auth/login` (solo logins correctos) | vacío |
| `auth.logout` | `POST /api/auth/logout` (barra lateral y «cerrar en todos los dispositivos») | vacío |

Cada fila guarda: `actor_id`, `actor_email`, `actor_role` (rol en el
momento), `action`, `entity`, `entity_id`, `lead_id` (solo eventos de lead),
`diff` y `created_at` (servidor).

### Decisiones

- **Nombres de acción:** `entidad.verbo` como en la spec
  (`lead.status_changed`). Se sustituyó el CHECK cerrado por uno de formato
  (`^[a-z][a-z_]*(\.[a-z][a-z_]*)?$`), así que las filas antiguas (`create`,
  `update`, `delete`, `role_change`) siguen siendo válidas y la UI las
  muestra con su etiqueta.
- **Una fila por mutación:** si un PATCH mezcla campos, la acción sigue la
  prioridad estado > reasignación > nota > resto y el diff lleva todos los
  campos. El PATCH masivo escribe una fila por lead.
- **Diff:** `{ "fields": [...], "changes": { campo: { from, to } } }`.
  `changes` solo existe para campos de la lista cerrada `LEAD_SAFE_FIELDS`
  (estado, responsable, favorito, archivado, puntuación, confianza, fechas de
  contacto/seguimiento), rol y ajustes no secretos. Email, teléfono, notas,
  mensajes, claves y cualquier otro campo guardan solo el nombre. Los valores
  se recortan a 120 caracteres.
- **Escritura solo desde servidor:** `logAudit` usa `createSupabaseAdminClient`
  (service_role) con el actor de `getApiSession`; nunca se lee del body. Un
  fallo de inserción se registra en log y no revierte la mutación.
- **Sin auditoría** para visitantes de la demo ni con `AUTH_DISABLED`.
- **Logins fallidos:** no se registran (fuera de esta entrega).

## 3. Diseño

- `public.audit_log` es append-only: `anon` sin acceso; `authenticated` solo
  `SELECT`; `service_role` solo `SELECT` e `INSERT`. Sin policy de insert.
- RLS de lectura: **Admin** lee todo; **Seller y Viewer** leen eventos con
  `lead_id` de leads que pueden ver (el `EXISTS` sobre `public.leads` aplica
  la misma RLS que los leads: el Seller solo los suyos, el Viewer todos);
  los eventos no-lead (ajustes, login, roles) son solo Admin.
- API: `GET /api/leads/:id/history` (cualquier rol con sesión, filtrado por
  RLS) y `GET /api/audit` (solo Admin; filtros `actor`, `action`, `from`,
  `to`, `page`; 25 por página).
- UI: sección «Historial» en la ficha del lead (compacta: quién, qué, cuándo,
  antes→después) y vista global Admin en Ajustes → «Historial de cambios»
  con filtros por usuario, acción y fechas y paginación. i18n ES/EN
  (`messages/*.json`, bloque `audit`).
- Los responsables se muestran por correo solo al Admin; Seller y Viewer ven
  «Tú» u «Otra persona».

## 4. Criterios de aceptación

- [x] Cada mutación de §2 crea una fila con actor correcto, también en el
  PATCH masivo (una por lead).
- [x] Un Admin lista eventos filtrados por actor/acción/fecha; un Seller no
  ve eventos de leads ajenos.
- [x] Escrituras directas por PostgREST con clave de rol de app son
  rechazadas.
- [x] Tests: atribución en cambio de estado, edición de nota (solo nombre) y
  reasignación (`src/lib/audit/*.test.ts`), componente
  (`src/components/audit`), migración y E2E contra Supabase local
  (`tests/e2e/audit-trail.spec.ts`).
- [ ] Correo, fusiones y análisis IA (segunda entrega).

## 5. Nota multiempresa

Si el workspace sirviera a empresas externas, `org_id` acotaría los eventos
por organización (Modelo A: BD compartida + columna de tenant) o cada
empresa tendría su propia BD con su `audit_log` (Modelo B: un proyecto por
empresa, mismas migraciones). Sin decisión por ahora; la columna nullable
`org_id` **no** existe todavía y se añadiría con una migración si hace falta.

## 6. Segunda entrega (pendiente)

- **Correo:** `lead.email_marked`, envío, vinculación/desvinculación de hilos.
- **Fusiones:** `lead.merged` (hoy `src/app/api/leads/merge` no audita).
- **Análisis IA:** `lead.ai_analyzed` (rutas `analyze`, `pain-analysis`, `score`).
- Intentos de login fallidos, exportación, feed en tiempo real y política de
  retención del historial siguen fuera de alcance.
