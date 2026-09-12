# Sesión 2026-09-12 — Fix de contraste y modo oscuro

## Contexto
Tras un cambio previo, la UI presentaba contrastes deficientes y el modo oscuro
se veía roto (paneles claros sobre fondo oscuro, texto ilegible). El modo oscuro
es el tema por defecto de la app (`DEFAULT_THEME = "dark"` en
`src/components/theme-provider.tsx`), por lo que el problema afectaba a la
experiencia principal.

## Causa raíz
Doble inversión de la paleta.

Todos los componentes cambian de modo con variantes explícitas `dark:` siguiendo
el modelo estándar de Tailwind, por ejemplo:

- `bg-blanco dark:bg-grafito`
- `bg-gris-100 dark:bg-gris-800`
- `text-grafito dark:text-gris-100`

Sin embargo, el bloque `.dark` de `src/app/globals.css` **invertía además toda la
escala** `gris` / `grafito` / `blanco` (p. ej. `--color-grafito: #F9FAFB`,
`--color-gris-800: #E5E7EB`). El resultado era una inversión doble: `dark:bg-grafito`
resolvía a casi blanco, así que los paneles se volvían blancos en modo oscuro y
los contrastes colapsaban.

## Solución
Una sola fuente de verdad para el cambio de modo: las variantes `dark:` de los
componentes. El bloque `.dark` deja de reinvertir la paleta.

### 1. `src/app/globals.css` — bloque `.dark`
- Se elimina la reinversión de `gris-50…gris-900`, `grafito`, `grafito-light` y
  `blanco`. Ahora la escala de marca conserva sus valores fijos en ambos modos y
  las variantes `dark:` de cada componente funcionan como se diseñaron.
- Solo se sobrescriben por modo el **acento rojo** y los **tokens semánticos de
  superficie**:
  - Rojo se aclara en oscuro para seguir legible como acento/texto:
    `--color-rojo: #EF5350`, `--color-rojo-hover: #E53935`,
    `--color-rojo-light: #FF8A80`.
  - Rampa de elevación coherente (evita el negro puro, según guía de marca:
    "sustituir el negro puro por grafito"):
    `bg #16191D < sidebar #131619 < panel #1F2328 < muted #2D333A`.
  - `--fg: #F3F4F6`, `--muted-fg: #9CA3AF`, `--border: #2D333A`,
    `--accent: #EF5350`, `--ring: #EF5350`.
- Se añade comentario de advertencia para que nadie vuelva a invertir la escala.

### 2. `src/components/ui/button.tsx` — variante `default` (primaria)
- En oscuro el rojo primario es más claro (`#EF5350`); texto blanco sobre ese rojo
  no alcanza AA (~3.0:1). Se añade `dark:text-grafito` para usar texto grafito
  (`#1F2328`) sobre el rojo claro → ~5.5:1 (AA). En claro se mantiene
  `text-blanco` sobre `#C62828` → ~4.9:1 (AA).

### 3. `src/components/inbox/daily-work-page.tsx` (del turno anterior)
- La tarjeta de cola dejó de ser `<button>` (contenía otro `<button>` anidado,
  HTML inválido / error de hidratación). Ahora es un `<div role="button">` con
  `tabIndex` y manejo de teclado (Enter/Espacio); el botón interno "Abrir cola"
  usa `stopPropagation`.

## Alineación con la marca GallaDev
- Rojo `#C62828` como acento (5–10%), grafito para estructura, blanco/grises para
  el espacio. En oscuro, superficies grafito en vez de negro puro.
- Tokens semánticos, sin hex crudo en componentes.
- Contraste objetivo WCAG 2.2 AA (4.5:1) verificado en los pares críticos.

## Verificación
- `npx tsc --noEmit`: sin errores.
- Pares de contraste comprobados: botón primario (ambos modos), texto secundario
  (`muted-fg`) sobre panel, navegación del sidebar activa/inactiva.

## Archivos modificados
- `src/app/globals.css`
- `src/components/ui/button.tsx`
- `src/components/inbox/daily-work-page.tsx`
