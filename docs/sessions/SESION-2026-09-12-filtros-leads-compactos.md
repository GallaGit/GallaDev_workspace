# Sesión 2026-09-12 — Rediseño compacto de filtros en Leads

## Contexto
La barra de filtros de `/leads` mostraba ~6 filas apiladas siempre visibles
(Estado 9 chips, Provincia 4, Ciudad 16, Empleados + 5 toggles, 4 date inputs):
~40 controles ocupando mucho alto vertical. Se pidió un patrón compacto estilo
Linear (chips de filtro + popover para añadir).

## Enfoque
Se adaptó el patrón UX de Linear al proyecto en lugar de copiar el componente
genérico propuesto (que usaba tokens shadcn `bg-primary`/`text-muted-foreground`,
datos demo Backlog/Andrew Luo, un modelo `Filter[]` local y dependencias no
instaladas `cmdk`/`nanoid`/`motion/react`/avatar).

Principios:
- **Cero dependencias nuevas** (se usa `@radix-ui/react-popover` ya instalado).
- **Sin modelo de estado paralelo**: los chips leen/escriben directamente sobre
  `LeadFilters` del store zustand (`setFilters`/`resetFilters`).
- **Sin cambios de lógica**: `filterLeads()` y el store quedan intactos.
- Tokens de marca (`bg-panel`, `bg-muted`, `border-border`, `text-fg`,
  `text-muted-fg`, acento rojo), no hex crudo.

## Resultado UX
Una sola fila (con wrap): `[🔍 Buscar] [chip Cola] [chips activos…] [+ Filtrar] [Limpiar]`
y a la derecha `Recalcular scores` + `Crear lead`.

Cada chip activo = `icono · Dimensión · resumen-valor · ✕`. Al clicar abre un
popover con el editor adecuado. El botón `+ Filtrar` abre una lista buscable de
dimensiones no activas y, al elegir una, muestra su editor en el mismo popover.

## Dimensiones y editores
- **Estado / Provincia / Ciudad** → multi-select con checkbox (Ciudad con buscador).
- **Con email / teléfono / web / LinkedIn / Favoritos** → tri-estado Sí/No/Cualquiera.
- **Empleados** → rango numérico Mín–Máx.
- **Creación / Actividad** → rango de fechas Desde–Hasta.

Operadores: solo "es (cualquiera de)" en multi-selects (decisión confirmada; sin
negación, para no tocar `filterLeads`/`LeadFilters`).

## Archivos
### Nuevos
- `src/components/ui/popover.tsx` — primitivo Popover con estilo de marca
  (`@radix-ui/react-popover`).
- `src/components/leads/filters/filter-config.tsx` — fuente única de dimensiones
  (icono Lucide, tipo, campos de `LeadFilters`, `isActive`, `summary`,
  `clearedFields`).
- `src/components/leads/filters/filter-value-editors.tsx` — editores por tipo
  (multi con búsqueda, booleano tri-estado, rango numérico, rango de fechas).
- `src/components/leads/filters/active-filter-chip.tsx` — chip activo + popover
  de edición + ✕ para quitar.
- `src/components/leads/filters/add-filter-popover.tsx` — botón `+ Filtrar` con
  lista buscable de dimensiones no activas y transición a su editor.

### Reescrito
- `src/components/leads/lead-filters.tsx` — nueva `LeadFiltersBar` compacta.

### Sin cambios
- `src/store/ui-store.ts`, `src/lib/leads/filter-leads.ts`,
  `src/components/leads/lead-table.tsx`, `leads-page-client.tsx`, modelo
  `LeadFilters`.

## Notas de implementación
- `lucide-react` de este proyecto no exporta `Linkedin`; se usó `Link2` para
  la dimensión "Con LinkedIn".
- El primitivo Popover no usa clases de `tailwindcss-animate` (el proyecto anima
  con framer-motion); se dejó sin animación de entrada para evitar clases muertas.
- Accesibilidad: `focus-visible` con ring rojo, `aria-label` en ✕ y triggers,
  navegación por teclado en listas.

## Verificación
- `npx tsc --noEmit`: sin errores.
- `npx eslint` sobre los archivos nuevos/modificados: sin errores.
- `LeadFiltersBar` solo se consume en `leads-page-client.tsx` (sin refs rotas).
- Pendiente: revisión visual en navegador (claro/oscuro) al levantar `npm run dev`.
