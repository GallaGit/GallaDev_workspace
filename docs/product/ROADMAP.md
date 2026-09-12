# Roadmap — Leads_CRM

**Fuente de producto:** [`DECISIONES.md`](./DECISIONES.md)  
**App:** raíz de este repositorio  
**Stack:** Next.js App Router, React, TypeScript, Tailwind, shadcn/ui, Lucide

No reabrir las decisiones de producto salvo petición explícita. Notion sigue siendo la fuente de verdad; no introducir Supabase como DB primaria en estas fases.

**Alineación n8n (2026-09-10):** el workflow de captación escribe estado `Nuevo`, `Origen=n8n`, email plano y cuerpo vacío; filtro operativo 3–10 empleados. Detalle en [`INTEGRACIONES.md`](./INTEGRACIONES.md). Webhooks CRM → n8n siguen fuera de v1 (decisión #12).

---

## Fase 0 — Validación (hecha)

- [x] Inspección del repo, Notion y n8n  
- [x] Arquitectura Parte 1 (A–I)  
- [x] 17 decisiones de producto cerradas y documentadas  
- [x] Checklist de esquema Notion documentado  

**Antes de código de sync real:** aplicar en Notion el checklist de [`DECISIONES.md` §3](./DECISIONES.md) (9 estados, `Favorito`, `Análisis IA`).

---

## Fase 1 — Foundation (Prompt 2)

Objetivo: shell usable, tema Linear-like, env seguro, tipos de dominio, cliente Notion.

- [x] Scaffold Next.js App Router en la raíz del repo
- [x] Tailwind + shadcn/ui + Lucide + dark/light
- [x] Sidebar + rutas vacías (español): Dashboard, Daily Work, Leads, Kanban, Statistics, Email, Automations, Settings
- [x] `.env.example`: `NOTION_TOKEN`, `NOTION_DATABASE_ID`, `AUTH_DISABLED=true`, placeholders SerpAPI/Groq/n8n
- [x] Dominio: `Lead`, `LeadStatus` (9 estados), mappers Notion ↔ dominio
- [x] `LeadRepository` + stub/`NotionLeadRepository`
- [x] Auth esqueleto: `auth` + middleware; sin login si `AUTH_DISABLED=true`
- [x] Compatibilidad estado: leer `Pendiente` → mapear a `Pendiente revisar`; escribir siempre el nombre nuevo

---

## Fase 2 — Sync + lista + drawer (Prompt 2)

- [x] Sync manual **Sincronizar** + sync on load; indicador last sync / error
- [x] `GET/PATCH` leads vía route handlers (secretos solo servidor)
- [x] Tabla de leads: búsqueda (empresa, dominio, email, ciudad, provincia, LinkedIn)
- [x] Drawer derecho: empresa, contacto, CRM, notas, acciones externas (web, LinkedIn, Maps, mailto, copy)
- [x] Persistencia: estado, notas (`Observaciones` + overflow cuerpo), favorito
- [x] Skeletons, empty, error, toasts; confirmación al archivar

---

## Fase 3 — Filtros, columnas, bulk, inline (Prompt 2)

- [x] Chips de filtro combinables (AND): provincia, ciudad, estado, empleados, fechas, has email/phone/web/LinkedIn
- [x] Normalización de ciudades (§4 DECISIONES)
- [x] Column picker, selección, bulk status / archivar / favorito
- [x] Inline status en fila
- [x] Deep-link `/leads?lead=<id>`

---

## Fase 4 — Home + Daily Work (Prompt 3)

- [x] KPIs: encontrados, pendientes, validados, emails preparados/enviados, respuestas, reuniones, clientes, conversion rate
- [x] Daily Work / Inbox: colas accionables (`Nuevo` + `Pendiente revisar`, faltan datos, emails listos incl. borrador en `Nuevo`, follow-up overdue, duplicados, etc.)
- [x] Deep links a filtros + abrir primer lead

---

## Fase 5 — Kanban + Email (Prompt 3)

- [x] Tablero 9 columnas; drag → persistir Estado en Notion
- [x] Panel email: ver/editar texto plano, copiar, marcar **Email preparado**
- [x] Abstracción de plantilla (`templates/outreach-v1`) para multi-template futuro

---

## Fase 6 — Duplicados + score + actividad (Prompt 3)

- [x] Detección: dominio, email, teléfono, nombre similar, dirección similar
- [x] UI compare / keep / archive / merge seguro (solo campos vacíos)
- [x] Incluir archivados en dedupe cuando aplique
- [x] `LeadScorer` modular; escribir `Lead Score`
- [x] Timeline desde bloques del cuerpo + comentario Notion por acción — trabajo previo/parcial (ver ESTADO Disponible); no entregado en ciclos 1–5 de la pasada 2026-09-04

---

## Fase 7 — AI + n8n client + Settings (Prompt 3)

- [x] Acción **Detectar dolores del negocio** → propiedad `Análisis IA` (evidencia / inferencia / especulación); drawer según `docs/ux/SPEC-detectar-dolores-drawer.md` (CTA fija, «Detectando…»)
- [x] `N8nClient` + Automations UI (cliente listo; en v1 sin trigger en el workflow n8n — no pegar URL ni activar toggles; la app dispara en alta/edición/análisis si el toggle está activo y hay URL)
- [x] Settings: Notion, SerpAPI (referencia), AI, n8n URLs; tests de conexión sin exponer secretos
- [x] Sync indicador completo (por integración: never / syncing / ok / error + lastSyncedAt)

---

## Fase 8 — Statistics (Prompt 3)

- [x] Breakdowns: estado, provincia, ciudad, tamaño
- [x] Tasas: validación, email preparado, respuesta, reunión, cliente, funnel
- [x] Sin gráficos decorativos

---

## Orden sugerido por prompt

| Prompt | Fases | Resultado |
|--------|-------|-----------|
| 1 | 0 + arquitectura | Hecho |
| 2 | 1–3 | Qualifier diario usable |
| 3 | 4–8 | Producto completo v1 |

---

## Fuera de roadmap v1

- Multi-usuario, roles, billing  
- Tags / Responsable  
- Sustituir Notion por otra DB  
- Envío automático de email / marketing automation  
- Añadir webhooks al workflow n8n (solo preparar el cliente)  
- Optimización mobile exhaustiva  
