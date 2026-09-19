# Contributing to GallaDev Workspace

> **Español:** [Guía de contribución en español](./CONTRIBUTING.es.md)

Thank you for contributing. This document is the single source of truth for how to work in this repository.

> Canonical repo: [`GallaGit/GallaDev_workspace`](https://github.com/GallaGit/GallaDev_workspace) (formerly `Leads_CRM`; that name still redirects).
> Default branch: `master`. All pull requests target `master`.

Please also read our [Code of Conduct](./CODE_OF_CONDUCT.md) and [Security Policy](./SECURITY.md).

## 1. Ways to contribute

- **Report a bug** — open an issue with the bug template (steps, expected vs. actual, env).
- **Request a feature** — open an issue with the feature template. Features that change product behavior should reference `docs/product/DECISIONES.md` or propose updating it.
- **Fix / build** — fork or branch, then open a pull request.
- **Improve docs** — documentation fixes follow the same PR process, no issue required for typos.

## 2. Prerequisites

- **Node.js 22** (matches CI) and `npm`.
- Copy the env template — never commit real secrets:

```bash
npm ci
cp .env.example .env.local   # PowerShell: Copy-Item .env.example .env.local
npm run dev
```

Open [http://localhost:3000/leads](http://localhost:3000/leads).

Key env facts (see `.env.example` for the full list):

| Variable | Meaning |
|---|---|
| `LEADS_DB_PROVIDER` | Ignored (always Supabase). Kept in `.env.example` for clarity. |
| `AUTH_DISABLED=true` | Local dev without login. Production requires `AUTH_SECRET` + `AUTH_PASSWORD`. |
| `INGEST_SECRET` | Shared secret for `POST /api/ingest/lead`. Generate with `openssl rand -hex 32`. |
| `RESEND_API_KEY`, `EMAIL_FROM_CLIENTS`, `EMAIL_NOTIFY_TO` | Transactional email after web ingest (fail-open: the lead is still saved if email fails). |

Production secrets live in **Vercel environment variables**, never in git.

## 3. Branching

Create branches from `master`:

```
feat/<short-slug>      new feature
fix/<short-slug>       bug fix
chore/<short-slug>     tooling, deps, CI
docs/<short-slug>      documentation only
```

Examples: `feat/kanban-filters`, `fix/dedupe-phone-match`, `docs/contribution-policy`.

Keep branches short-lived and focused: one issue, one PR.

## 4. Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short imperative description in English>

feat(ingest): send Resend receipt after web lead
fix(dedupe): match normalized phone with country prefix
chore(ci): run e2e against production build
docs(readme): correct source of truth to Supabase
```

- Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`.
- Keep the subject under ~72 chars. Use the body for rationale and breaking changes.
- We squash-merge PRs, so the **PR title** must also follow this format — it becomes the commit on `master`.

## 5. Definition of done (run before every PR)

```bash
npm run lint
npx tsc --noEmit
npm run test:unit
npm run test:component
npm run build
npm run test:e2e      # needs a production build; CI runs it for you
```

Full pipeline shortcut: `npm run test:ci` (unit + component + e2e).

Testing conventions (details in [`TESTING.md`](./TESTING.md)):

- Unit tests live next to the source: `*.test.ts` (`npm run test:unit`).
- Component tests use Testing Library, user-facing queries first (`npm run test:component`).
- E2E tests live in `tests/e2e/` and use `data-testid` selectors (`npm run test:e2e`).
- Coverage targets: 80% lines/functions, 70% branches.
- New behavior without a test is grounds for requesting changes.

## 6. Pull requests

1. Rebase or merge `master` into your branch so CI runs on current code.
2. Fill in the PR template: linked issue, what changed, how it was verified, screenshots for UI changes.
3. Requirements for merge:
   - CI green (`Lint & TypeCheck`, `Unit Tests`, `Component Tests`, `E2E Tests`).
   - No secrets committed (see §7).
   - No required approvals while this is a solo project — merge your own PR once CI is green. When the team grows, enable "Require a pull request before merging" with 1 approval (see §9).
   - PR title in Conventional Commits format (it becomes the squash commit).
4. Keep PRs small and reviewable. Refactors and behavior changes go in separate PRs.

## 7. Secrets policy (hard rule)

- **Never** commit `.env.local`, real API keys, tokens, passwords, or `data/settings.local.json` overrides (both are gitignored — keep it that way).
- UI overrides written from Settings live in gitignored `data/settings.local.json`; APIs never return full secrets (masked previews only).
- Before pushing, check: `git status --short` and `git diff --cached --name-only`.
- If you leak a secret: rotate it immediately, then tell a maintainer — do not just delete it in a follow-up commit (history keeps it).

## 8. Project-specific notes

- **Source of truth is Supabase (PostgreSQL).** `getLeadRepository()` in `src/lib/repository/get-repository.ts` always returns `SupabaseLeadRepository` (Notion runtime removed). New persistence code must implement the `LeadRepository` interface, not import provider types in UI or route handlers.
- **Lead pipeline:** exactly 9 statuses (`Nuevo`, `Pendiente revisar`, `Validado`, `Email preparado`, `Email enviado`, `Respondió`, `Reunión`, `Cliente`, `Descartado`). Legacy Notion names are normalized on read, never written.
- **n8n prospecting** writes new leads (`Origen=n8n`, state `Nuevo`); the CRM never edits the capture workflow. Webhook dispatches are best-effort and must never fail persistence.
- **UI language is Spanish.** Code, commits, issues, and PRs are in English; user-facing strings in Spanish.
- **Docs hierarchy** (see [`docs/README.md`](./docs/README.md)): `docs/product/DECISIONES.md` wins on product conflicts, then `src/` code, then `docs/product/ROADMAP.md`.

## 9. Admin checklist (maintainers)

Solo-dev mode (current): no required reviewers — you merge your own PRs after CI is green.

- Branch protection on `master`: required status checks (`Lint & TypeCheck`, `Unit Tests`, `Component Tests`, `E2E Tests`), require branches up to date, block force pushes and deletions, squash-merge only. **Do not** require pull request reviews or Code Owners review while solo.
- When a second contributor joins: enable "Require a pull request before merging" with 1 approval + Code Owners review + dismiss stale approvals.
- Security: secret scanning + push protection enabled; Security Advisories open for private reports.
- About section: current description, `https://workspace.galladev.com` homepage, topics (`nextjs`, `typescript`, `supabase`, `crm`, `n8n`, `tailwindcss`).

## 10. Getting help

Open a [discussion or issue](https://github.com/GallaGit/GallaDev_workspace/issues) with context: what you tried, command output, and relevant env (without secrets). For security matters, follow [`SECURITY.md`](./SECURITY.md) instead of opening a public issue.
