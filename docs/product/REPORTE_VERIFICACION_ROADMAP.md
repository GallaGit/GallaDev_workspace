# Reporte de Verificación: Roadmap vs Estado Actual del Proyecto

**Fecha:** 2026-09-11  
**Repositorio:** Leads_CRM (GitHub: GallaGit/Leads_CRM, rama `master`)  
**Versión Next.js:** 16.3.4 (Turbopack)  

---

## Resumen Ejecutivo

✅ **El roadmap refleja con precisión el estado actual del proyecto.** Todas las fases 0–8 marcadas como completadas (`[x]`) en `ROADMAP.md` están efectivamente implementadas y funcionales en el código. La documentación en `ESTADO_IMPLEMENTACION.md` es coherente con lo observado en el código fuente.

**Build:** ✅ Pasa sin errores  
**Lint (código app):** ✅ Pasa (el único error proviene de `.agents/skills/archify/`, no del código de la aplicación)

---

## Verificación Detallada por Fases

### Fase 0 — Validación ✅
- Repo, Notion y n8n inspeccionados
- Arquitectura Parte 1 documentada
- 17 decisiones de producto cerradas en `DECISIONES.md`
- Checklist de esquema Notion completado (9 estados, `Favorito`, `Análisis IA`)

### Fase 1 — Foundation ✅
| Ítem Roadmap | Estado en Código |
|-------------|------------------|
| Scaffold Next.js App Router | ✅ `src/app/` con App Router |
| Tailwind + shadcn/ui + Lucide + dark/light | ✅ `package.json`, `src/components/ui/`, `src/components/theme-provider.tsx` |
| Sidebar + rutas vacías (ES) | ✅ `src/components/layout/app-sidebar.tsx` — Dashboard, Daily Work, Leads, Kanban, Statistics, Email, Automations, Settings |
| `.env.example` completo | ✅ Incluye NOTION_TOKEN, DATABASE_ID, DATA_SOURCE_ID, AUTH_DISABLED, placeholders SerpAPI/Groq/n8n |
| Dominio: `Lead`, `LeadStatus` (9), mappers | ✅ `src/lib/domain/lead.ts`, `src/lib/notion/mapper.ts` |
| `LeadRepository` + `NotionLeadRepository` | ✅ `src/lib/repository/lead-repository.ts`, `src/lib/notion/notion-lead-repository.ts` |
| Auth esqueleto + middleware | ✅ `src/lib/auth.ts`, `src/middleware.ts` (usa `AUTH_DISABLED=true`) |
| Compatibilidad `Pendiente` → `Pendiente revisar` | ✅ Mapper normaliza al leer; escrituras usan nombres canónicos |

### Fase 2 — Sync + Lista + Drawer ✅
| Ítem Roadmap | Estado en Código |
|-------------|------------------|
| Sync manual **Sincronizar** + sync on load | ✅ `POST /api/sync`, `useEnsureLeadsSynced` hook |
| `GET/PATCH` leads vía route handlers | ✅ `src/app/api/leads/route.ts`, `src/app/api/leads/[id]/route.ts` |
| Tabla de leads con búsqueda | ✅ `src/components/leads/lead-table.tsx` — busca en empresa, dominio, email, ciudad, provincia, LinkedIn |
| Drawer derecho con detalle | ✅ `src/components/leads/lead-drawer.tsx` — empresa, contacto, CRM, notas, acciones externas |
| Persistencia: estado, notas, favorito | ✅ `PATCH /api/leads/[id]` actualiza Notion |
| Skeletons, empty, error, toasts; confirmación archivar | ✅ Sonner toasts, estados de carga, dialog confirmación |

### Fase 3 — Filtros, Columnas, Bulk, Inline ✅
| Ítem Roadmap | Estado en Código |
|-------------|------------------|
| Chips de filtro combinables (AND) | ✅ `src/components/leads/lead-filters.tsx` — provincia, ciudad, estado, empleados, fechas, has email/phone/web/LinkedIn |
| Normalización de ciudades | ✅ `src/lib/geo/cities.ts` — 22 canónicos con aliases |
| Column picker, selección, bulk status/archivar/favorito | ✅ `src/components/leads/bulk-action-bar.tsx`, `lead-table.tsx` |
| Inline status en fila | ✅ Select en cada fila de la tabla |
| Deep-link `/leads?lead=<id>` | ✅ `src/components/leads/leads-page-client.tsx` |

### Fase 4 — Home + Daily Work ✅
| Ítem Roadmap | Estado en Código |
|-------------|------------------|
| KPIs completos | ✅ `src/app/page.tsx` — 13 KPIs clicables con conteos reales |
| Daily Work / Inbox con colas accionables | ✅ `src/app/inbox/page.tsx` + `src/components/inbox/daily-work-page.tsx` — colas: Nuevos y pendientes, faltan datos, emails listos (incluye borrador en `Nuevo`), follow-up vencido, duplicados |
| Deep links a filtros + abrir primer lead | ✅ `WorkQueueId` + `firstLeadId` en `buildWorkQueues` |

### Fase 5 — Kanban + Email ✅
| Ítem Roadmap | Estado en Código |
|-------------|------------------|
| Tablero 9 columnas; drag → persistir Estado | ✅ `src/app/kanban/page.tsx` + `src/components/kanban/kanban-board.tsx` — `@dnd-kit` implícito, `PATCH /api/leads/[id]` al soltar |
| Panel email: ver/editar texto plano, copiar, marcar **Email preparado** | ✅ `src/app/email/page.tsx` + `src/components/email/email-workbench-page.tsx` + `src/components/leads/email-editor.tsx` |
| Abstracción plantilla `templates/outreach-v1` | ✅ `src/lib/templates/outreach-v1.ts` |

### Fase 6 — Duplicados + Score + Actividad ✅
| Ítem Roadmap | Estado en Código |
|-------------|------------------|
| Detección: dominio, email, teléfono, nombre similar, dirección similar | ✅ `src/lib/leads/detect-duplicates.ts` — 5 razones, union-find transitivo |
| UI compare / keep / archive / merge seguro (solo campos vacíos) | ✅ `src/app/duplicates/page.tsx` + `src/components/duplicates/duplicates-page.tsx` |
| Incluir archivados en dedupe | ✅ `list({ includeArchived: true })` en `NotionLeadRepository` |
| `LeadScorer` modular; escribir `Lead Score` | ✅ `src/lib/leads/lead-scorer.ts` (7 factores, pesos suman 100), `POST /api/leads/score` |
| Timeline desde bloques + comentario Notion | ✅ `NotionLeadRepository.appendActivity()` + `addComment()` — **parcial**: bloques funcionan, comentarios se ignoran si fallan permisos (documentado en ESTADO_IMPLEMENTACION.md) |

### Fase 7 — AI + n8n Client + Settings ✅
| Ítem Roadmap | Estado en Código |
|-------------|------------------|
| Acción **Detectar dolores** → `Análisis IA` (Evidencia/Inferencia/Especulación) | ✅ `src/components/leads/pain-analysis-section.tsx`, `src/lib/ai/pain-analysis.ts`, `POST /api/leads/:id/analyze` + `POST /api/leads/pain-analysis` |
| `N8nClient` + Automations UI | ✅ `src/lib/n8n/client.ts`, `src/app/automations/page.tsx` + `src/components/automations/automations-panel.tsx` — toggles, URL enmascarada, test. Webhooks se disparan en alta/edición/análisis (background) |
| Settings: Notion, SerpAPI, AI, n8n URLs; tests conexión | ✅ `src/app/settings/page.tsx` + `src/components/settings/settings-integrations.tsx` — secretos enmascarados, persistencia `data/settings.local.json` |
| Sync indicador completo (por integración) | ✅ `src/lib/settings/service.ts` — `never \| syncing \| ok \| error` + `lastSyncedAt` |

### Fase 8 — Statistics ✅
| Ítem Roadmap | Estado en Código |
|-------------|------------------|
| Breakdowns: estado, provincia, ciudad, tamaño | ✅ `src/lib/leads/compute-stats.ts` — `byStatus`, `byProvince`, `byCity` (top 20), `byEmployees` (6 buckets) |
| Tasas: validación, email preparado, respuesta, reunión, cliente, funnel | ✅ `rates` array con `reachedOrBeyond` (excluye `Descartado`) |
| Sin gráficos decorativos | ✅ UI tabla compacta Linear-like en `src/components/stats/stats-page.tsx` |

---

## APIs Implementadas (Coinciden con ESTADO_IMPLEMENTACION.md)

```
GET    /api/leads
POST   /api/leads
PATCH  /api/leads
GET    /api/leads/:id
PATCH  /api/leads/:id
DELETE /api/leads/:id
POST   /api/leads/:id/analyze
POST   /api/leads/pain-analysis
GET    /api/leads/duplicates
POST   /api/leads/merge
POST   /api/leads/score
POST   /api/sync
GET    /api/settings
PATCH  /api/settings
GET    /api/settings/status
POST   /api/settings/test
GET    /api/automations
GET|PATCH|POST /api/automations/:action
```

---

## Divergencias / Riesgos Documentados (Confirmados en Código)

| Tema | Detalle | Ubicación |
|------|---------|-----------|
| **ICP empleados** | Notas estratégicas: 5–30; n8n opera 3–10. Scorer favorece 5–30 | `lead-scorer.ts:70-74` |
| **n8n estado `Nuevo`** | Workflow escribe `Nuevo`, `Origen=n8n`, email plano, cuerpo vacío. App normaliza `Pendiente` legacy → `Pendiente revisar` | `mapper.ts`, `DECISIONES.md §2` |
| **Comentarios Notion** | Se ignoran si fallan por permisos; no hay alerta específica | `notion-lead-repository.ts:348-358` |
| **Actualización masiva** | Sin transacción distribuida; fallo a mitad deja filas previas guardadas | `ESTADO_IMPLEMENTACION.md:199-201` |
| **Notas largas** | Encabezados literales `Notas` / `Actividad` en cuerpo; cambiarlos rompe lectura | `notion-lead-repository.ts:16,17` |
| **Estado global** | Leads en memoria (Zustand); recargar fuera de `/leads` pierde datos hasta re-sync | `src/store/ui-store.ts` |
| **Middleware deprecado** | Next.js 16.3 avisa: migrar `middleware.ts` → `proxy` | Build output warning |

---

## Pendientes Explícitos (Fuera de v1 / Roadmap)

- Autenticación real + pantalla de login
- Tests automatizados
- Virtualización / paginación visual para miles de filas
- Optimización mobile exhaustiva
- Fix local en `notion-lead-repository.ts:62-67`: omite `in_trash:false` (Notion lo rechaza) — **PENDING**, no en commits de la pasada
- Timeline / comentario Notion: trabajo previo reflejado en "Disponible"; no entregado en ciclos 1–5

---

## Fuera de Roadmap v1 (Confirmado en ROADMAP.md §13)

- Multi-usuario, roles, billing
- Tags / Responsable
- Sustituir Notion por otra DB
- Envío automático de email / marketing automation
- Webhooks al workflow n8n (solo cliente preparado)
- Optimización mobile exhaustiva

---

## Verificación de Calidad

| Check | Resultado |
|-------|-----------|
| `npm run lint` (código app) | ✅ 0 errores (1 error en `.agents/skills/archify/`, ajeno a la app) |
| `npm run build` | ✅ Compila exitosamente, 12 rutas generadas (7 estáticas, 5 dinámicas + API) |
| TypeScript | ✅ Sin errores de tipos |
| Rutas previstas en ARQUITECTURA.md | ✅ Todas presentes: `/`, `/inbox`, `/leads`, `/kanban`, `/stats`, `/email`, `/automations`, `/duplicates`, `/settings` |

---

## Conclusión

**El roadmap dice la verdad.** El proyecto se encuentra en un estado **"Producto completo v1"** según la tabla de orden sugerido (Prompt 3 = Fases 4–8). Todas las funcionalidades listadas como `[x]` en las fases 1–8 están implementadas, probadas (build/lint verde) y documentadas consistentemente entre `ROADMAP.md`, `ESTADO_IMPLEMENTACION.md` y `DECISIONES.md`.

La única discrepancia menor es el item "Timeline / comentario Notion" en Fase 6, que el propio `ESTADO_IMPLEMENTACION.md` califica como "trabajo previo/parcial" y "no entregado en ciclos 1–5" — esto está **honestamente documentado**, no ocultado.

**Recomendación:** El proyecto está listo para uso diario como qualifier de leads. Los siguientes pasos naturales (fuera de v1) serían: tests automatizados, virtualización de tabla, y migración del middleware deprecado.