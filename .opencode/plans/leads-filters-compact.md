# Plan — Rediseño compacto de filtros en Leads (estilo Linear)

## Decisiones confirmadas
- Multi-selects: **solo operador "es (cualquiera de)"** (sin negación). No se toca `filterLeads` ni `LeadFilters`.
- Alcance: **solo la barra de filtros de Leads**.
- **Cero dependencias nuevas** (se usa `@radix-ui/react-popover`, `@radix-ui/react-checkbox`, `lucide-react`, `framer-motion`, todos ya instalados).

## Problema
`src/components/leads/lead-filters.tsx` (309 líneas) muestra ~6 filas apiladas siempre visibles (Estado 9 chips, Provincia 4, Ciudad 16, Empleados + 5 toggles, 4 date inputs). Ocupa demasiado alto vertical.

## Objetivo
Una sola fila estilo Linear: `[🔍 Buscar] [chips activos…] [+ Filtrar] [Limpiar]`.
Cada chip activo = `icono · Dimensión · resumen-valor · ✕`; al clicar abre popover de edición.

## Restricción clave
NO copiar el `filters.tsx`/`demo.tsx` aportado (usa tokens shadcn `bg-primary`/`text-muted-foreground`, datos demo Backlog/Andrew Luo, modelo `Filter[]` local, deps `cmdk`/`nanoid`/`motion/react`/avatar). Se adapta el patrón UX al store real y tokens de marca.

## Backend sin cambios
`filterLeads()` ya soporta status[], province[], city[], employeesMin/Max, createdFrom/To, activityFrom/To, hasEmail/Phone/Website/Linkedin (true/false), favorite (true/false). Los chips leen/escriben directamente sobre `LeadFilters` del store zustand (`setFilters`/`resetFilters`). No se introduce modelo paralelo.

## Archivos NUEVOS
1. `src/components/ui/popover.tsx`
   - Primitivo Popover con `@radix-ui/react-popover`.
   - Content: `z-[400] w-64 rounded-lg border border-(--border) bg-(--panel) p-1 text-(--fg) shadow-lg`, animaciones data-state, `align="start"`, `sideOffset={6}`.
   - Exporta `Popover, PopoverTrigger, PopoverAnchor, PopoverContent`.

2. `src/components/leads/filters/filter-config.tsx`
   - Fuente única de verdad de dimensiones. Por cada dimensión: `key`, `label`, `icon` (Lucide), `kind` (`multi` | `boolean` | `range-num` | `range-date`), y helpers:
     - `isActive(filters)`, `summary(filters)` (texto del chip, p.ej. "Nuevo +2", "Sí", "5–50", "desde 01/09"),
     - `clear(setFilters)` para quitar la dimensión.
   - Dimensiones: Estado (`status`), Provincia (`province`), Ciudad (`city`), Empleados (`employeesMin/Max`), Con email (`hasEmail`), Con teléfono (`hasPhone`), Con web (`hasWebsite`), Con LinkedIn (`hasLinkedin`), Favoritos (`favorite`), Creación (`createdFrom/To`), Actividad (`activityFrom/To`).
   - Iconos sugeridos: CircleDashed (Estado), MapPin (Provincia), Building2 (Ciudad), Users (Empleados), Mail, Phone, Globe, Linkedin, Star (Favoritos), CalendarPlus (Creación), CalendarSync (Actividad).

3. `src/components/leads/filters/filter-value-editors.tsx`
   - Contenido de popover por tipo:
     - `MultiSelectEditor`: lista con checkbox; Ciudad incluye input de búsqueda interno (filtra las opciones); opciones vienen de `LEAD_STATUSES`, `PROVINCES`, o ciudades derivadas de leads (misma lógica que hoy).
     - `BooleanEditor`: tri-estado (Sí / No / Cualquiera) → escribe `true|false|null`.
     - `NumRangeEditor`: dos inputs Min/Max.
     - `DateRangeEditor`: dos inputs date From/To.

4. `src/components/leads/filters/active-filter-chip.tsx`
   - Chip compacto: botón con icono + label + resumen; envuelto en Popover que abre el editor correspondiente; botón ✕ para `clear`.
   - Estilo: `rounded-md border border-(--border) bg-(--muted) px-2 py-1 text-xs text-(--fg)`, hover marca, focus-visible ring rojo.

5. `src/components/leads/filters/add-filter-popover.tsx`
   - Botón `+ Filtrar` (Button variant ghost/outline, size sm, icono `ListFilter`).
   - Popover con lista buscable (input + filtrado en cliente, sin `cmdk`) de las dimensiones **no activas**. Al elegir, activa la dimensión con un valor inicial sensato y abre su editor.

## Archivo REESCRITO
6. `src/components/leads/lead-filters.tsx` → nueva `LeadFiltersBar`:
   - Fila única flex-wrap: `Input` de búsqueda (siempre visible) + chip de Cola (`activeQueue`, se conserva) + chips activos derivados de `filters` + `AddFilterPopover` + botón `Limpiar` (cuando `hasActive`).
   - Bloque derecho conservado: **Recalcular scores** (misma función `recalculateScores`) y **CreateLeadDialog**.
   - Se conserva `clearQueue` y la lógica `resetFilters()` + `setActiveQueue(null)` + `router.replace("/leads")`.

## SIN cambios
`ui-store.ts`, `filter-leads.ts`, `lead-table.tsx`, `leads-page-client.tsx`, modelo `LeadFilters`.

## Accesibilidad / marca (skill ui-ux-pro-max)
- Focus visible (ring rojo), `aria-label` en ✕ y triggers, navegación teclado en listas.
- Tokens de marca ya corregidos (bg-panel/muted, border-border, text-fg/muted-fg, accent rojo). Sin hex crudo.
- Motion sutil 150ms; respeta `prefers-reduced-motion` (ya global).

## Verificación
- `npx tsc --noEmit` y `npm run lint` sin errores.
- Revisar en claro/oscuro que los chips y popovers se ven correctos.
- Confirmar que añadir/editar/quitar/Limpiar filtros afecta la tabla igual que antes (paridad con el comportamiento actual de `filterLeads`).

## Documentación final
- Nota breve en `docs/` (nueva sesión) resumiendo el rediseño, como se pidió en tareas previas.
