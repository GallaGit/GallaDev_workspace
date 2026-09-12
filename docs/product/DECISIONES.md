# Decisiones de producto — Leads_CRM

**Estado:** cerrado  
**Fecha:** 2026-09-04  
**Alcance:** especificación para Prompt 2+. No reabrir salvo petición explícita.

La aplicación Next.js vive en la raíz de este repositorio. Este documento es la fuente de verdad de producto hasta que el código exista.

---

## 1. Decisiones cerradas (17)

| # | Tema | Decisión |
|---|------|----------|
| 1 | Pipeline | Exactamente 9 estados (ver §2). |
| 2 | Leads de n8n | Entran en **Nuevo**. Daily Work los lista en la cola de pendientes/nuevos y, si ya tienen borrador, en “emails listos para revisar”. Leads_CRM **no** los pasa solo a **Email preparado**. |
| 3 | Tags | **Sin tags en v1.** No crear propiedad `Tags`. No reutilizar `Servicios` como tags. |
| 4 | Favorito | **Sí.** Nueva checkbox Notion `Favorito`, persistida en Notion (no solo local). |
| 5 | Responsable | **Omitido en v1** (un solo usuario). No crear propiedad. |
| 6 | Análisis IA | Nueva propiedad Notion `Análisis IA` (rich_text / texto largo). Leer y escribir desde Leads_CRM. |
| 7 | Actividad | **Dos vías:** (1) bloques fechados en el cuerpo de la página = fuente de la timeline de Leads_CRM; (2) comentario Notion por acción relevante. No actividad solo en memoria. |
| 8 | Borrar | **Archivar** (`archived: true`). Auditoría + detección de duplicados frente a archivados si hace falta. |
| 9 | Merge | Solo rellenar campos **vacíos** del lead que se queda. Nunca sobrescribir. El otro se archiva. Confirmación obligatoria. |
| 10 | UI | **Español.** |
| 11 | Auth | Uso **local sin login**. Esqueleto preparado (`auth` + middleware; `AUTH_DISABLED=true`). Sin equipos, roles ni billing. |
| 12 | n8n webhooks | Capa lista en Leads_CRM (Settings + `N8nClient`). **No** añadir triggers webhook al workflow ahora. |
| 13 | Búsqueda externa | **SerpAPI** (lo que usa n8n). Settings: SerpAPI, no SearchAPI. |
| 14 | Email generado | Mostrar y editar como **texto plano**. Al leer: convertir `<br>` y `\[Nombre\]`. |
| 15 | Ciudad | Normalizar (ver §4). Filtros y stats usan el nombre canónico. |
| 16 | Notas | `Observaciones` = campo principal. Aviso cerca del límite Notion (~2000). Excedente → sección **Notas** en el cuerpo de la página. No truncar en silencio. |
| 17 | Ubicación app | Raíz de este repositorio. |

---

## 2. Pipeline (9 estados)

Orden canónico:

1. Nuevo  
2. Pendiente revisar  
3. Validado  
4. Email preparado  
5. Email enviado  
6. Respondió  
7. Reunión  
8. Cliente  
9. Descartado  

Estos nombres deben usarse de forma idéntica en lista, Kanban, filtros, KPIs y Daily Work.

### Migración desde opciones actuales de Notion

| Opción antigua | Acción |
|----------------|--------|
| `Pendiente` | Renombrar → `Pendiente revisar` (migrar filas existentes) |
| `Contactado` | Renombrar → `Email enviado` |
| `Contratado` | Renombrar → `Cliente` |
| `Descartado` | Mantener |
| — | Añadir: `Nuevo`, `Validado`, `Email preparado`, `Respondió`, `Reunión` |

**Entrada n8n:** el workflow escribe `Nuevo` (actualizado 2026-09-10). El mapper de Leads_CRM sigue aceptando `Pendiente` legacy al leer y lo normaliza a `Pendiente revisar`; las escrituras de la app usan siempre los 9 nombres canónicos.

---

## 3. Checklist de cambios Notion

**Base de datos:** [Leads Asesorías Valencia](https://app.notion.com/p/ed07cdd4c5424f9a8b8ebd73e358c6cd?v=3d6c7fabc5824158b2d31a969dc1d001)  
**Database ID:** `ed07cdd4-c542-4f9a-8b8e-bd73e358c6cd`  
**Data source:** `collection://27fefc60-8dfd-4356-9465-582d3c49d99f`

### Estado (select)

- [x] Renombrar `Pendiente` → `Pendiente revisar`
- [x] Migrar filas con `Pendiente` al nuevo valor
- [x] Renombrar `Contactado` → `Email enviado`
- [x] Renombrar `Contratado` → `Cliente`
- [x] Mantener `Descartado`
- [x] Añadir `Nuevo`
- [x] Añadir `Validado`
- [x] Añadir `Email preparado`
- [x] Añadir `Respondió`
- [x] Añadir `Reunión`
- [x] Verificar que las 9 opciones existen y no quedan nombres antiguos en uso

### Propiedades nuevas

- [x] Crear `Favorito` — checkbox
- [x] Crear `Análisis IA` — rich_text / texto largo

### Prohibido en v1

- [x] **No** crear `Tags`
- [x] **No** crear `Responsable`
- [x] **No** crear otra base de datos para leads / actividad / tags

### Cuerpo de página

- [x] Usar el cuerpo (hoy vacío) para: timeline de actividad + overflow de notas (sección **Notas**) *(implementado en app)*
- [x] Comentarios Notion por acciones relevantes (además de bloques) *(implementado en app)*

### Propiedades existentes a mapear (no inventar nombres)

| Dominio | Notion | Tipo |
|---------|--------|------|
| Empresa | Empresa | title |
| Web | Web | url |
| Teléfono | Teléfono | phone_number |
| Dirección | Dirección | text |
| CP | CP | text |
| Ciudad | Ciudad | text |
| Provincia | Provincia | select |
| Empleados | Empleados | number |
| LinkedIn | LinkedIn | url |
| Sector / servicios | Servicios | multi_select |
| Estado | Estado | select |
| Última actividad | Última actualización | date |
| Alta / descubrimiento | Fecha de descubrimiento | date |
| Notas | Observaciones | text |
| Asunto email | Asunto email | text |
| Cuerpo email | Email generado | text |
| Score | Lead Score | number |
| Gerente | Gerente | text |
| Cargo | Cargo | text |
| Confianza extracción | Confianza | select |
| Software | Software | text |
| Origen | Origen | text |
| Emails | Correo General / Comercial / Gerente | email |
| Último contacto | Último contacto | date |
| Seguimiento | Próximo seguimiento | date |
| Favorito | Favorito | checkbox *(nuevo)* |
| Análisis IA | Análisis IA | rich_text *(nuevo)* |

IDs técnicos (no UI de negocio): `page_id`, `url`, `last_edited_time`, `archived`.

---

## 4. Normalización de ciudades (área ~30 km Valencia)

Filtros y estadísticas usan el **nombre canónico**. Aliases se pliegan al canónico (sin acentos en comparación; display con forma canónica).

| Canónico | Alias aceptados (ejemplos) |
|----------|----------------------------|
| Valencia | València, Valencia |
| Castellón | Castelló, Castellon, Castellón |
| Sagunto | Sagunt, Sagunto |
| Mislata | Mislata |
| Xirivella | Xirivella |
| Torrent | Torrent |
| Paterna | Paterna |
| Manises | Manises |
| Burjassot | Burjassot |
| Alboraya | Alboraia, Alboraya |
| Catarroja | Catarroja |
| Silla | Silla |
| Aldaia | Aldaya, Aldaia |
| Paiporta | Paiporta |
| Godella | Godella |
| Moncada | Montcada, Moncada |
| Picassent | Picassent |
| El Puig | El Puig, Puig |

Lista alineada con el workflow n8n de captación (radio ~30 km). Extensible en código (`lib/geo/cities.ts` o similar) sin cambiar Notion.

---

## 5. Recomendaciones técnicas cerradas

### SerpAPI (no SearchAPI)

El workflow n8n usa `serpapi.com` (Google Maps). En Settings de Leads_CRM: configuración / referencia a **SerpAPI**. No exponer SearchAPI salvo decisión futura.

### Notas y límite Notion

1. Escribir primero en `Observaciones` (límite práctico ~2000 caracteres rich_text).  
2. UI: aviso al acercarse al límite.  
3. Excedente: sección **Notas** en el cuerpo de la página.  
4. Nunca truncar en silencio.

### Email en texto plano

Al leer `Email generado` / `Asunto email`:

- Sustituir `<br>`, `<br/>`, `<br />` por saltos de línea.  
- Normalizar `\[Nombre\]` → `[Nombre]` (o placeholder editable).  
- Strip HTML residual básico si aparece.  
- Persistencia: texto plano (sin reintroducir HTML innecesario).

### Auth preparado

- Local: `AUTH_DISABLED=true` → middleware no exige sesión.  
- Módulo `auth` + middleware listos para PIN/credentials más adelante.  
- Sin pantalla de login en v1.  
- Sin multi-tenant / roles / billing.

### n8n

- Cliente de webhooks + Settings con URLs configurables vía env.  
- Workflow `Leads Asesorias Valencia` alineado (2026-09-10): estado `Nuevo`, `Origen=n8n`, email plano, cuerpo vacío, dedupe con email/archivados.  
- Filtro operativo de empleados: **3–10** (ICP estratégico 5–30 sin cambiar en n8n).  
- **No** añadir triggers webhook al workflow en v1 (decisión #12).

### Archivo y duplicados

- “Eliminar” = archivar.  
- Merge seguro = solo campos vacíos del keeper; loser archivado.  
- Consultas de deduplicación pueden incluir archivados cuando el producto lo requiera.

### Actividad

Por acción relevante (cambio de estado, notas, email, IA, archivo, merge, etc.):

1. Bloque fechado en el cuerpo (timeline de Leads_CRM).  
2. Comentario Notion (visibilidad al abrir la página en Notion).

---

## 6. Arquitectura (recordatorio, sin implementar aquí)

- Next.js App Router + React + TypeScript + Tailwind + shadcn/ui.  
- Notion = fuente de verdad; `LeadRepository` + `NotionLeadRepository`.  
- Secretos solo en servidor.  
- UI Linear-like; drawer de detalle; español.

Rutas previstas: `/`, `/inbox`, `/leads`, `/kanban`, `/stats`, `/email`, `/automations`, `/duplicates`, `/settings`.

Detalle de fases: ver [`ROADMAP.md`](./ROADMAP.md).

---

## 7. Fuera de alcance de este documento

- Implementar la aplicación Next.js (Prompt 2+).  
- Editar el workflow n8n.  
- Crear propiedades distintas a las listadas en §3.
