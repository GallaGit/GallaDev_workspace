# Roadmap — GallaDev Workspace (antes Leads_CRM)

**Fuente de producto:** [`DECISIONES.md`](./DECISIONES.md)  
**App:** raíz de este repositorio  
**Stack:** Next.js App Router, React, TypeScript, Tailwind, shadcn/ui, Lucide, Supabase (PostgreSQL)

Producto v1.0: 8 fases completadas (ver REPORTE_VERIFICACION_ROADMAP.md).
DB: Supabase es la única fuente de verdad desde el PR #30 (runtime Notion eliminado).
Auth: login mínimo + TTL + logout + cierre global de emergencia desde el PR #31 (detalle en GEM_ROADMAP 1.5).
No reabrir decisiones v1 salvo que sean los items explicitly planificados en v2.0.

**Ejecución:** el plan operativo (seguridad → tests → acabado → SaaS) vive en [`GEM_ROADMAP.md`](./GEM_ROADMAP.md).

**Captación (decisión #18: n8n opcional):** cualquier fuente entra con estado `Nuevo` + `Origen` (`n8n`, `web-galladev`, `Manual`). El workflow n8n escribe email plano y cuerpo vacío con filtro operativo 3–10 empleados; las vías propias (`Nuevo lead`, `/api/ingest/*`) no dependen de él. Detalle en [`INTEGRACIONES.md`](./INTEGRACIONES.md). Webhooks CRM → automatización siguen fuera de v1 (decisión #12).

---

## Fase 0 — Validación (hecha)

- [x] Inspección del repo, Notion y n8n  
- [x] Arquitectura Parte 1 (A–I)  
- [x] 17 decisiones de producto cerradas y documentadas  
- [x] Checklist de esquema Notion documentado  

**Antes de código de sync real:** aplicar en Notion el checklist de [`DECISIONES.md` §3](./DECISIONES.md) (9 estados, `Favorito`, `Análisis IA`).

---

## Fase 1 — Foundation (Prompt 2)

Objetivo: shell usable, tema Linear-like, env seguro, tipos de dominio, cliente de persistencia (Notion en v1, Supabase desde el PR #30).

- [x] Scaffold Next.js App Router en la raíz del repo
- [x] Tailwind + shadcn/ui + Lucide + dark/light
- [x] Sidebar + rutas vacías (español): Dashboard, Daily Work, Leads, Kanban, Statistics, Email, Automations, Settings
- [x] `.env.example`: Supabase URL/keys, `AUTH_DISABLED=true`, placeholders SerpAPI/Groq/n8n (vars Notion eliminadas en #30)
- [x] Dominio: `Lead`, `LeadStatus` (9 estados), mappers proveedor ↔ dominio
- [x] `LeadRepository` + `SupabaseLeadRepository` (el `NotionLeadRepository` de v1 se eliminó en #30)
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

- [x] Tablero 9 columnas; drag → persistir Estado (Notion en v1, Supabase desde #30)
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
- [x] Settings: SerpAPI (referencia), AI, n8n URLs; tests de conexión sin exponer secretos (sección Notion eliminada en #30; sección Seguridad añadida en #31)
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

## v2.0 — Core Features (Planificación 2026-09 en adelante)

**Decision strategica**: Sustituir Notion por Supabase (PostgreSQL) para habilitar multi-usuario, roles, billing y reemplazar DB fuente de verdad.

**Arquitectura v2.0**:
- Supabase: Proyecto creado, RLS policies, schema leads (status enum, tags text[], responsable UUID)
- Billing: Stripe integration (planes Free/Pro/Enterprise, webhooks)
- Automatización: cola interna propia (n8n queda como proveedor opcional, no como dependencia)
- Email marketing: SendGrid/Mailgun triggers por status changes y tag updates
- Real-time: Supabase subscriptions para triggers instantáneos

### Fases v2.0

#### Fase 1 — Supabase Setup & Migration (hecha, PR #30)
- [x] Proyecto Supabase creado y configurado
- [x] Migración Notion → Supabase: leads, tags, users
- [x] Schema definition: leads table con status enum, tags text[], responsable UUID
- [x] Runtime Notion eliminado: Supabase es la única fuente de verdad
- [x] Migración validada: la app opera en Supabase
- [ ] Row-level security por rol (solo existe la permisiva de dev)
- [ ] Stripe integration preparada (webhooks endpoints)
- [ ] Proveedores externos (n8n y futuros) solo vía contrato de ingesta (`Nuevo` + `Origen`); sin lógica de negocio fuera del CRM

#### Fase 2 — Multi-usuario & Roles (Semana 2-3)
- [ ] Roles definidos: Admin, Seller, Viewer
- [ ] Permisos RLS por rol (solo sus leads, ver todos, solo lectura)
- [ ] Autenticación multiusuario (hoy: sesión propia HMAC de un solo usuario + cierre global de emergencia, PR #31; NextAuth/Supabase JWT queda como opción a decidir)
- [ ] Routing protegido: Routes `/leads`, `/kanban`, `/settings` por rol
- [ ] Triggers de automatización con contexto usuario (cola interna; n8n solo como proveedor opcional)

#### Fase 3 — Tags / Responsable & Billing (Semana 3-4)
- [ ] UI Tags: Chips component con autocomplete tags
- [ ] Assign Responsable: Dropdown users per lead
- [ ] Billing UI: Plan selector, subscription status display
- [ ] Email triggers: Status change → SendGrid notification
- [ ] Marketing basic: Tag-based segmentation

#### Fase 4 — Automatización propia & Marketing Automation (Semana 4-5)
- [ ] Cola interna (`work_queue` en Supabase): qué toca, por qué, reintentos; sustituye los dispatches best-effort actuales
- [ ] Webhooks configurados: Lead created, status changed, tag updated (proveedor intercambiable, hoy n8n opcional)
- [ ] Automation flows: CRM → cola → Email/Mailing (sin depender de n8n)
- [ ] Real-time subscribers: Supabase channels para triggers instantáneos

#### Fase 5 — Optimización Mobile Exhaustiva (Semana 5-6)
- [ ] Responsive audit: Todas las páginas v1.2 + v2.0 en mobile
- [ ] Touch gestures: Swipe kanban, tap tags, mobile status select
- [ ] Performance: Lazy loading, reduced motion mobile, font scaling
- [ ] Device testing: iPhone SE, iPhone 15, Android flagship, iPad
- [ ] WCAG 2.2 AA: Contrast móvil, viewport, keyboard navigation

### Dependencias v2.0
```bash
npm install @supabase/ssr @supabase/js-sdk stripe @sendgrid/mail
# Automatización: cola interna en Supabase; n8n (o Make/Zapier) solo como proveedor opcional vía contrato de ingesta
```

### Skills requeridos v2.0
- `supabase` - configuración y RLS policies
- `stripe` - billing integration
- `sendgrid` o `mailgun` - email automation
- `cola interna` - work queue propia en Supabase (n8n opcional, no dependencia)

### Migración Notion → Supabase
- Mapping exacto de propiedades Notion a columnas Supabase
- Tags array handling: Notion multi-select → PostgreSQL text[]
- Responsable reference: Notion user ID → Supabase auth.users UUID
- Status pipeline: 9 estados Notion → lead_status enum PostgreSQL

### Riesgos y Mitigación
- Datos perdidos en migración: Backup Notion antes de export, validar conteo rows
- RLS bloqueando accesos: Testing exhaustivo permisos por rol
- Dependencia de n8n: mitigación ya aplicada — contrato de ingesta propio (`Nuevo` + `Origen`), vías sin n8n y dispatches best-effort (decisión #18); objetivo: apagar n8n sin perder captación
- Precios Stripe inesperados: Monitoring webhooks y alertas

---

## v2.0 Plan — Items "Fuera de roadmap v1"

- [ ] **Multi-usuario, roles, billing** — Supabase RLS + Stripe integration
- [ ] **Tags / Responsable** — UI chips + DB assignment + filtering
- [x] **Sustituir Notion por otra DB** — hecho en PR #30 (Supabase única fuente, runtime Notion eliminado)
- [ ] **Envío automático de email / marketing automation** — SendGrid triggers por status/tag changes
- [ ] **Automatización con cola interna** — cliente HTTP ya preparado; cola `work_queue` con reintentos en vez de más nodos n8n (decisión #18)
- [ ] **Optimización mobile exhaustiva** — Responsive audit, touch gestures, device testing, WCAG 2.2 AA mobile

### Estado actual (2026-09-21)
- v1.0: 8 fases completadas y verificadas
- v1.2: dark mode arreglado (#28), filtros compactos; resto del refresh visual pendiente
- v2.0 Fase 1: hecha — Supabase única fuente (#30), migración validada
- Auth: login mínimo + TTL + logout + cierre global de emergencia (#31); fix fail-closed y scroll de Settings en curso
- PR #32 abierto: scroll en Settings/Automations

Siguiente paso: resto de Fase 1 del GEM_ROADMAP (RLS por rol, headers, rate-limit, `AUTH_SECRET` obligatorio) hacia el hito M1.