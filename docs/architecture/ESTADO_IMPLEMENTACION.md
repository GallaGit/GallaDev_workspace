# Estado de implementación

Fecha de revisión: 2026-09-10 (Fase 7: Detectar dolores IA + persistencia `Análisis IA`; alineación n8n: estado `Nuevo`, email plano, dedupe email/archivados; filtro 3–10 operativo; Daily Work incluye borrador en `Nuevo`). Revisión previa 2026-09-07: SettingsService + N8nClient + UI Integraciones/Automations. El repositorio está en GitHub (`GallaGit/Leads_CRM`); el merge de duplicados ya está en código (ver Disponible).

Este documento describe el comportamiento del código actual. No sustituye a [`DECISIONES.md`](./DECISIONES.md) ni al [`ROADMAP.md`](./ROADMAP.md).

Sesión de referencia de la pasada Development: [`SESION-2026-09-04-dev-pass.md`](./SESION-2026-09-04-dev-pass.md).

## Disponible

### Base de la aplicación

- Next.js App Router.
- React y TypeScript.
- Tailwind CSS.
- tema claro y oscuro con provider propio (`ThemeProvider` + script SSR);
- interfaz compacta inspirada en Linear;
- navegación lateral;
- toasts con Sonner;
- estado cliente con Zustand;
- shell en español.

### Notion

- cliente servidor con `@notionhq/client`;
- consulta paginada del data source;
- creación de páginas (`pages.create` sobre data source);
- mapeo Notion → `Lead`;
- actualizaciones parciales;
- compatibilidad con estados históricos;
- archivo de páginas;
- notas largas en cuerpo de página;
- timeline basada en bloques;
- intento de comentario Notion en acciones relevantes.

### Gestión de leads

- sincronización al abrir `/leads`;
- sincronización compartida al abrir Home, Daily Work, Kanban, Email y Statistics;
- botón manual **Sincronizar**;
- alta manual con **Nuevo lead** (dialog + validación + `POST /api/leads`);
- Daily Work con colas accionables y deep-link `?queue=`;
- Kanban de 9 estados con drag-and-drop;
- workbench `/email` con editor compartido y plantilla `outreach-v1`;
- indicador de última sincronización y errores;
- búsqueda;
- filtros combinables;
- normalización de ciudades;
- orden de columnas;
- visibilidad de columnas persistida;
- selección de filas;
- acciones masivas;
- cambio de estado inline;
- panel derecho de detalle;
- edición de notas;
- edición y copia de email en texto plano;
- favorito;
- **Detectar dolores** en el drawer (Groq → `Análisis IA` con Evidencia / Inferencia / Especulación);
- archivo con confirmación;
- enlaces externos a web, LinkedIn, Google Maps y cliente de email;
- deep-link mediante `/leads?lead=<id>`.

### APIs

- `GET /api/leads`
- `POST /api/leads`
- `PATCH /api/leads`
- `GET /api/leads/:id`
- `PATCH /api/leads/:id`
- `DELETE /api/leads/:id`
- `POST /api/leads/:id/analyze`
- `POST /api/leads/pain-analysis` *(alias)*
- `GET /api/leads/duplicates`
- `POST /api/leads/merge`
- `POST /api/leads/score`
- `POST /api/sync`
- `GET /api/settings`
- `PATCH /api/settings`
- `GET /api/settings/status`
- `POST /api/settings/test`
- `GET /api/automations`
- `GET|PATCH|POST /api/automations/:action`

### Configuración

- `.env.example`;
- `SettingsService` (`src/lib/settings/`): mezcla env + `data/settings.local.json`;
- secretos solo en servidor (flags + preview de 4 caracteres en la UI);
- tests de conexión Notion / n8n / Groq / SerpAPI;
- estado de conexión por integración (`never` | `syncing` | `ok` | `error`, `lastSyncedAt`);
- auth preparada y deshabilitada en local;
- `N8nClient` con timeout, errores HTTP/JSON y métodos lead created/updated/analyzed.

### Detectar dolores (Fase 7)

- botón **Detectar dolores** en la barra de acciones del drawer (después de Favorito, antes de Archivar); CTA fija en el header (sin scroll); al analizar: spinner + «Detectando…»;
- spec UX: `docs/ux/SPEC-detectar-dolores-drawer.md`;
- sección **Dolores** (`ai-analysis-panel.tsx`) debajo de CRM;
- `POST /api/leads/:id/analyze` (drawer Front) y `POST /api/leads/pain-analysis` (contrato Grok: `{ id?, lead?, persist? }`) llaman a Groq (`analyzeBusinessPains` → `groq-client`, secretos solo servidor) y escriben Notion `Análisis IA` (rich_text) si persist;
- contrato: `docs/CONTRACT-pain-analysis.md` — Evidencia / Inferencia / Especulación; Groq → 502 `{ error: { code: "ai_error" } }` sin corromper el lead;
- salida estructurada **Evidencia / Inferencia / Especulación** (`src/lib/ai/pain-analysis.ts`); la UI muestra tres bloques, no un `<pre>` crudo;
- re-ejecutar está permitido y sobrescribe el análisis; sin confirmación en v1;
- un fallo de Groq no modifica el lead; actividad (`ai_analyzed`, no `ai_analysis`) y comentario Notion en best-effort como el resto de acciones;
- si *Lead analizado* está activo, `dispatchLeadAnalyzed` → `notifyLeadAnalyzed` en segundo plano.

## Parcial

### Dashboard

La página principal sincroniza leads al cargar, muestra KPIs clicables hacia colas/filtros y enlaces a Daily Work y Leads.

### Daily Work

`/inbox` lista colas: **Nuevos y pendientes** (`Nuevo` + `Pendiente revisar`), faltan datos, emails listos (borrador en `Nuevo`, `Pendiente revisar`, `Validado` o estado `Email preparado`), follow-up vencido, duplicados. Abrir una cola navega a `/leads?queue=…&lead=…`.

### Email

Workbench en `/email` para revisar borradores. El mismo editor vive en el drawer de Leads. Plantilla `outreach-v1` aplicable con confirmación si el cuerpo no está vacío.

### Automations

Página de configuración (no edita workflows n8n): toggles Nuevo Lead / Lead actualizado / Lead analizado, URL de webhook enmascarada, activa/inactiva y botón **Probar**. Tras persistir en Notion, el alta (`POST /api/leads`), las actualizaciones (`PATCH` individual y masiva; fusión si rellena campos) y **Detectar dolores** (`POST /api/leads/:id/analyze` → `notifyLeadAnalyzed`) disparan el webhook correspondiente en segundo plano si el toggle está activo y hay URL. En v1 no hay triggers en el workflow ni URLs configuradas (decisión #12). Un fallo de n8n se registra y no revierte el lead. Un fallo de Groq no escribe `Análisis IA`.

### Settings

Integraciones editables (Notion, n8n, IA/Groq, SerpAPI) con secretos enmascarados, Guardar y Probar conexión. Persistencia en archivo local gitignored; `.env.local` sigue siendo el arranque.

### Actividad

Estado, notas, email, archivo y análisis IA (`ai_analyzed`) generan eventos. No todas las posibles ediciones del modelo tienen una categoría de actividad específica.

### Archivo y duplicados

El archivo individual y masivo funciona. La consulta habitual (`list()` / sync) sigue devolviendo leads activos.

Detección y fusión de duplicados (ciclos 2–3):

- librería pura `src/lib/leads/detect-duplicates.ts` (email, teléfono, dominio; opcional nombre/dirección normalizados);
- `GET /api/leads/duplicates` lista grupos con motivos e incluye archivados (`list({ includeArchived: true })`);
- `POST /api/leads/merge` con `{ keepId, archiveId }`: rellena solo campos vacíos del lead conservado, archiva el otro (DECISIONES #9);
- `src/lib/leads/merge-leads.ts` calcula el patch vacío-solo y la vista previa de campos;
- página `/duplicates` con comparación lado a lado, Conservar / Archivar / Fusionar y confirmación obligatoria; al éxito se refrescan los grupos.

### Score (ciclo 4)

- librería modular `src/lib/leads/lead-scorer.ts` (`scoreLead` → `{ total, breakdown }`);
- pesos 0–100: email 20, teléfono 15, web 10, LinkedIn 10, empleados ICP 20, ciudad conocida 10, progreso de estado 15;
- `POST /api/leads/score` con `{ ids?: string[] }` (omitido = todos los activos); escribe Notion `Lead Score`;
- botón **Recalcular scores** en `/leads` (selección o todos); columna Score en la tabla.

### Statistics (ciclo 5 / fase 8)

- página `/stats` con sync compartido (`useEnsureLeadsSynced`);
- librería pura `src/lib/leads/compute-stats.ts`;
- breakdowns: estado (9), provincia, ciudad (top 20), tamaño empleados (Sin dato / 1–4 / 5–30 ICP / 31–50 / 51+ / 0);
- tasas de funnel (alcanzó etapa o posterior, Descartado excluido): validación, email preparado, respuesta, reunión, cliente;
- conteos del funnel de 9 estados (count + %);
- UI compacta Linear-like en español, sin librerías de gráficos.

## Pasada Development 2026-09-04 (confirmado)

Rama de aquella pasada: `improve/dev-pass-fase6`. En su momento no había remoto git. El repositorio está ahora en GitHub: [`GallaGit/Leads_CRM`](https://github.com/GallaGit/Leads_CRM) (rama `master`). Business y Release estaban fuera de alcance de esa pasada.

| Ciclo | Commit | Resumen |
|-------|--------|---------|
| 1 | `dcd0bf8` | `fix(lint)`: efecto en lead-drawer y opciones de list no usadas |
| 2 | `8161fe5` | `feat(leads)`: detección de duplicados por dominio, email y teléfono |
| 3 | `e29075d` | `feat(leads)`: merge seguro solo de campos vacíos |
| 4 | `191c8fe` | `feat(leads)`: LeadScorer modular y escritura de Notion `Lead Score` |
| 5 | `c8176c3` | `feat(stats)`: breakdowns por estado, provincia, ciudad y funnel |

Archivos/rutas confirmados en filesystem: `detect-duplicates.ts`, `merge-leads.ts`, `lead-scorer.ts`, `compute-stats.ts`, `app/duplicates`, `app/stats`, `api/leads/duplicates|merge|score`.

Detalle de la sesión: [`SESION-2026-09-04-dev-pass.md`](./SESION-2026-09-04-dev-pass.md).

## Pendiente

- autenticación real y pantalla de login;
- tests automatizados;
- virtualización o paginación visual para miles de filas;
- optimización específica para móvil;
- cambio local sin commit en `src/lib/notion/notion-lead-repository.ts`: omite `in_trash:false` al consultar páginas activas (Notion rechaza `in_trash:false`). **PENDING** — no forma parte de los 5 commits de la pasada;
- ítem ROADMAP Fase 6 «Timeline / comentario Notion»: trabajo previo ya reflejado en Disponible (timeline por bloques + intento de comentario); no entregado en los ciclos 1–5 de esta pasada.


## Riesgos y divergencias conocidas

### ICP

Las notas estratégicas definen 5–30 empleados; n8n opera en **3–10** (decisión operativa 2026-09-10). Leads_CRM permite filtrar cualquier rango; el scorer de la app favorece 5–30.

### n8n y estado

El workflow `Leads Asesorias Valencia` escribe `Nuevo`, `Origen=n8n`, email plano y cuerpo vacío. La app mantiene compatibilidad de lectura con `Pendiente` legacy. Daily Work incluye esos leads en “Nuevos y pendientes” y, si tienen borrador, en “Emails listos”. Webhooks `lead.*` siguen fuera de v1 (solo cliente en Leads_CRM; no pegar URL).

### Comentarios Notion

La creación de comentarios se ignora si falla por permisos. La actividad en bloques continúa, pero actualmente no hay una alerta específica de “comentario no creado”.

### Actualización masiva

No existe transacción distribuida. Si una actualización de varias filas falla a mitad, las anteriores ya pueden estar guardadas. La UI muestra el error, pero no revierte Notion.

### Notas largas

La implementación identifica bloques por los encabezados literales `Notas` y `Actividad`. Cambiarlos manualmente puede romper la lectura o causar secciones duplicadas.

### Estado global

Los leads se conservan en memoria, no en almacenamiento persistente. Al recargar fuera de `/leads`, Leads_CRM puede no tener datos hasta volver a sincronizar.

## Verificación

Estado al cierre de la pasada Development (2026-09-04), según PM/Development:

- tras `dcd0bf8` y en HEAD `c8176c3`: lint y build en verde al final de cada ciclo (informe PM/Development);
- esta revisión documental **no** re-ejecutó comandos de comprobación;
- Next.js puede seguir avisando que la convención `middleware.ts` está deprecada y recomienda migrar a `proxy` (aviso previo; no revalidado aquí).

Comandos de comprobación (para quien los ejecute de nuevo): scripts `lint` y `build` del package.
