# Contribuir a GallaDev Workspace

Gracias por contribuir. Este documento es la única fuente de verdad sobre cómo trabajar en este repositorio.

> **English:** [Contributing in English](./CONTRIBUTING.md)
> Repo canónico: [`GallaGit/GallaDev_workspace`](https://github.com/GallaGit/GallaDev_workspace) (antes `Leads_CRM`; ese nombre aún redirige).
> Rama por defecto: `master`. Todos los pull requests apuntan a `master`.

Lee también nuestro [Código de conducta](./CODE_OF_CONDUCT.es.md) y la [Política de seguridad](./SECURITY.es.md).

## 1. Formas de contribuir

- **Reportar un bug** — abre un issue con la plantilla de bug (pasos, esperado vs. real, entorno).
- **Pedir una funcionalidad** — abre un issue con la plantilla de funcionalidad. Los cambios de comportamiento del producto deberían referenciar `docs/product/DECISIONES.md` o proponer actualizarlo.
- **Corregir / construir** — haz fork o crea una rama, luego abre un pull request.
- **Mejorar la documentación** — los arreglos de docs siguen el mismo proceso de PR; para erratas no hace falta issue.

## 2. Requisitos previos

- **Node.js 22** (igual que CI) y `npm`.
- Copia la plantilla de entorno — nunca commitees secretos reales:

```bash
npm ci
cp .env.example .env.local   # PowerShell: Copy-Item .env.example .env.local
npm run dev
```

Abre [http://localhost:3000/leads](http://localhost:3000/leads).

Variables clave (ver `.env.example` para la lista completa):

| Variable | Significado |
|---|---|
| `LEADS_DB_PROVIDER` | Fuente de verdad. Por defecto `supabase`. Solo usa `notion` para despliegues legacy. |
| `AUTH_DISABLED=true` | Desarrollo local sin login. Producción requiere `AUTH_SECRET` + `AUTH_PASSWORD`. |
| `INGEST_SECRET` | Secreto compartido para `POST /api/ingest/lead`. Genera con `openssl rand -hex 32`. |
| `RESEND_API_KEY`, `EMAIL_FROM_CLIENTS`, `EMAIL_NOTIFY_TO` | Email transaccional tras ingesta web (fail-open: el lead se guarda aunque falle el email). |

Los secretos de producción viven en las **variables de entorno de Vercel**, nunca en git.

## 3. Ramas

Crea las ramas desde `master`:

```
feat/<slug-corto>      nueva funcionalidad
fix/<slug-corto>       corrección de bug
chore/<slug-corto>     tooling, dependencias, CI
docs/<slug-corto>      solo documentación
```

Ejemplos: `feat/filtros-kanban`, `fix/dedupe-telefono`, `docs/politica-contribucion`.

Mantén las ramas cortas y enfocadas: un issue, un PR.

## 4. Mensajes de commit

Usamos [Conventional Commits](https://www.conventionalcommits.org/) (en inglés):

```
<type>(<scope>): <short imperative description in English>

feat(ingest): send Resend receipt after web lead
fix(dedupe): match normalized phone with country prefix
chore(ci): run e2e against production build
docs(readme): correct source of truth to Supabase
```

- Tipos: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`.
- Asunto de ~72 caracteres como máximo. Usa el cuerpo para el porqué y los breaking changes.
- Hacemos squash-merge de los PRs, así que el **título del PR** también debe seguir este formato — se convierte en el commit en `master`.

## 5. Definition of done (antes de cada PR)

```bash
npm run lint
npx tsc --noEmit
npm run test:unit
npm run test:component
npm run build
npm run test:e2e      # necesita build de producción; CI lo ejecuta por ti
```

Atajo del pipeline completo: `npm run test:ci` (unit + component + e2e).

Convenciones de testing (detalle en [`TESTING.md`](./TESTING.md)):

- Los unit tests viven junto al código: `*.test.ts` (`npm run test:unit`).
- Los tests de componentes usan Testing Library, priorizando queries orientadas al usuario (`npm run test:component`).
- Los tests E2E viven en `tests/e2e/` y usan selectores `data-testid` (`npm run test:e2e`).
- Objetivos de cobertura: 80% líneas/funciones, 70% ramas.
- Un comportamiento nuevo sin test es motivo para pedir cambios.

## 6. Pull requests

1. Rebasea o mergea `master` en tu rama para que CI corra sobre código actual.
2. Rellena la plantilla del PR (en inglés): issue enlazado, qué cambió, cómo se verificó, capturas para cambios de UI.
3. Requisitos para merge:
   - CI en verde (`Lint & TypeCheck`, `Unit Tests`, `Component Tests`, `E2E Tests`).
   - Sin secretos commiteados (ver §7).
   - Sin aprobaciones obligatorias mientras sea un proyecto individual — mergea tu propio PR cuando CI esté en verde. Cuando crezca el equipo, se activará "Require a pull request before merging" con 1 aprobación (ver §9).
   - Título del PR en formato Conventional Commits (se convierte en el commit squash).
4. Mantén los PRs pequeños y revisables. Refactors y cambios de comportamiento van en PRs separados.

## 7. Política de secretos (regla dura)

- **Nunca** commitees `.env.local`, API keys reales, tokens, contraseñas ni overrides de `data/settings.local.json` (ambos están en gitignore — que siga así).
- Los overrides de UI escritos desde Settings viven en el gitignoreado `data/settings.local.json`; las APIs nunca devuelven secretos completos (solo vistas enmascaradas).
- Antes de pushear, revisa: `git status --short` y `git diff --cached --name-only`.
- Si filtras un secreto: rótalo de inmediato y avisa a un maintainer — no basta con borrarlo en un commit posterior (el historial lo conserva).

## 8. Notas específicas del proyecto

- **La fuente de verdad es Supabase (PostgreSQL).** `getLeadRepository()` en `src/lib/repository/get-repository.ts` devuelve `SupabaseLeadRepository` por defecto; `NotionLeadRepository` es legacy y solo se usa cuando `LEADS_DB_PROVIDER=notion` se configura explícitamente. El código nuevo de persistencia debe implementar la interfaz `LeadRepository`, sin importar tipos del proveedor en la UI ni en los route handlers.
- **Pipeline de leads:** exactamente 9 estados (`Nuevo`, `Pendiente revisar`, `Validado`, `Email preparado`, `Email enviado`, `Respondió`, `Reunión`, `Cliente`, `Descartado`). Los nombres legacy de Notion se normalizan al leer, nunca se escriben.
- **La prospección con n8n** escribe leads nuevos (`Origen=n8n`, estado `Nuevo`); el CRM nunca edita el workflow de captación. Los dispatches de webhooks son best-effort y nunca deben impedir la persistencia.
- **La UI está en español.** Código, commits, issues y PRs van en inglés; las cadenas visibles al usuario, en español.
- **Jerarquía de docs** (ver [`docs/README.md`](./docs/README.md)): `docs/product/DECISIONES.md` gana en conflictos de producto, luego el código en `src/`, luego `docs/product/ROADMAP.md`.

## 9. Checklist de administración (maintainers)

Modo individual (actual): sin revisores obligatorios — mergea tus propios PRs cuando CI esté en verde.

- Protección de la rama `master`: checks obligatorios (`Lint & TypeCheck`, `Unit Tests`, `Component Tests`, `E2E Tests`), exigir ramas actualizadas, bloquear force pushes y borrados, solo squash-merge. **No** exigir revisiones de PR ni de Code Owners mientras sea individual.
- Cuando se una un segundo contribuidor: activar "Require a pull request before merging" con 1 aprobación + revisión de Code Owners + descartar aprobaciones obsoletas.
- Seguridad: secret scanning + push protection activados; Security Advisories abiertos para reportes privados.
- Sección About: descripción actual, homepage `https://workspace.galladev.com`, topics (`nextjs`, `typescript`, `supabase`, `crm`, `n8n`, `tailwindcss`).

## 10. Pedir ayuda

Abre una [discusión o issue](https://github.com/GallaGit/GallaDev_workspace/issues) con contexto: qué intentaste, salida de comandos y entorno relevante (sin secretos). Para temas de seguridad, sigue la [`SECURITY.es.md`](./SECURITY.es.md) en lugar de abrir un issue público.
