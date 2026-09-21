# Agent Workflow — reglas anti-rotura silenciosa

> Alcance: toda sesión con agente (humano + IA) que modifique código en este repo.
> Objetivo: que si algo se rompe, **grite en CI**, no "al tiempo".
> Complementa [`CONTRIBUTING.md`](../../CONTRIBUTING.md) (proceso de PR) y [`docs/product/GEM_ROADMAP.md`](../../docs/product/GEM_ROADMAP.md) (fases).

## Regla 0 — Fuera de `main`, SIEMPRE

Nadie trabaja directo en `main`/`master`: ni humano, ni agente, ni "un cambio chiquito".

1. Todo trabajo empieza creando rama desde `master` actualizado: `git checkout -b feat|fix|chore|docs/<slug>`.
2. Antes de editar, verificar `git status --branch`: si estás en `master`, PARA y crea la rama primero.
3. Cambios sin commitear en `master` se mueven a rama (`git checkout -b <rama>` los arrastra y `master` queda limpio); jamás se commitean en `master`.
4. `master` solo avanza por squash-merge de PRs con CI verde. Push directo a `master`: prohibido.
5. Tras el merge, borrar la rama (local + remota).

## Regla 1 — Test-tripwire primero

Antes de modificar un área sin cobertura (rutas `src/app/api/**`, repositorios, `src/lib/auth*`, `src/lib/automations/**`):

1. Escribe el test que describe el **comportamiento actual** (input → output/error).
2. Verifícalo en verde **antes** del cambio.
3. El cambio solo se acepta si el tripwire sigue verde.

Sin tripwire, no hay refactor. Excepción: solo-docs.

## Regla 2 — Un PR = un área

Prohibidos los refactors cruzados. Si un cambio toca 3 carpetas (p. ej. `ingest` + `automations` + `settings`), son 3 PRs apilados o secuenciales, no uno.

- Ramas según `CONTRIBUTING.md`: `feat|fix|chore|docs/<slug>`.
- Título en Conventional Commits (es el commit squash en `master`).

## Regla 3 — Mapa de blast radius en cada PR

Todo PR declara:

- **Archivos afectados** (lista explícita, no "varios").
- **Qué verifica cada uno** (comando concreto: `npm run test:unit`, `npx tsc --noEmit`, `npm run test:e2e`, etc.).
- **Qué NO se tocó** y por qué (p. ej. "ingests intactos: son receptores push, fuera de alcance").

La plantilla de PR ya lo exige: cumplirla de verdad, no marcar casillas a ciegas.

## Regla 4 — Paridad demostrable al mover comportamiento

Todo PR que **mueve** comportamiento (p. ej. n8n → interno, Notion → Supabase):

1. Test de contrato **antes**: mismo input → mismo resultado observable (lead creado, email enviado, estado persistido).
2. El cambio debe pasar ese contrato **después**, sin modificarlo.
3. "Parece que funciona" no es verificación. El contrato sí.

## Regla 5 — Orden seguro: red antes que trapecio

Nunca internalizar/migrar comportamiento sobre áreas sin tests. Orden obligatorio:

1. Tests del comportamiento existente (tripwires en verde).
2. Implementación interna en paralelo (toggle interno/externo cuando exista, como `getAutomationClient()`).
3. Paridad verificada (Regla 4) → conmutar → eliminar lo viejo en PR separado.

## Principio permanente — Preferir lo propio

Si algo existente cumple la misma función que una alternativa externa, **se queda lo propio** salvo mejora obvia: seguridad, compatibilidad futura o simplificación demostrable. Registrar la decisión en el PR (una línea basta).

## Checklist de sesión (copiar al empezar trabajo con agente)

- [ ] ¿Estoy fuera de `main`? Rama creada desde `master` actualizado (Regla 0).
- [ ] ¿El área tiene tests? Si no → Regla 1 primero.
- [ ] ¿El PR toca un solo área? Si no → dividir (Regla 2).
- [ ] ¿Blast radius declarado con comandos? (Regla 3).
- [ ] ¿Mueve comportamiento? → contrato antes/después (Regla 4).
- [ ] ¿Hay red (tests) antes del trapecio (migración)? (Regla 5).
