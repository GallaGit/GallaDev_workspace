# Security Policy

> **Español:** [Política de seguridad en español](./SECURITY.es.md)

## Supported versions

| Version | Supported |
|---|---|
| `master` (latest) | Yes |
| Older commits / forks | Best effort only |

We ship from `master` to production (`https://workspace.galladev.com`). If you run a fork or an older commit, upgrade to `master` first.

## Reporting a vulnerability

**Do not open a public issue.** Report privately via
[GitHub Security Advisories](https://github.com/GallaGit/GallaDev_workspace/security/advisories/new).

Include:

- Description and impact.
- Steps to reproduce (without live secrets or personal data).
- Affected routes, commit, and environment.

We aim to acknowledge within 72 hours, share a remediation plan, and credit reporters (unless anonymity is preferred).

## Secrets and data handling

- Never put real keys, tokens, passwords, or customer data in issues, PRs, logs, or test fixtures.
- Local secrets belong in gitignored `.env.local` / `data/settings.local.json`; production secrets in Vercel environment variables.
- If you suspect a leak, rotate the credential immediately and notify a maintainer — deleting it in a later commit is not enough (git history retains it).

## Scope notes

- Auth is Supabase Auth (email + password). Roles `Admin`, `Seller`, and `Viewer` come from `profiles.role`. An authenticated user with no profile row, or a role outside that enum, is denied (`401`, `code: "no_profile"`). There is no self-signup: an Admin creates users in the Supabase Dashboard; the `on_auth_user_created` trigger assigns Seller.
- `AUTH_DISABLED=true` (or `1`) skips session checks only outside production. In production it is fail-closed: `NODE_ENV=production` keeps auth on. `AUTH_SECRET`, `AUTH_PASSWORD`, and `SESSION_TTL_DAYS` are not used.
- **Cerrar todas las sesiones** (Settings → Seguridad) calls `supabase.auth.signOut({ scope: "global" })`. The sidebar logout calls `supabase.auth.signOut()` with no scope argument. There is no `POST /api/auth/logout-all` and the app does not read `app_session_epoch`.
- Visitor demo: an HMAC-SHA256 httpOnly cookie (`gdw_visitor`, 4 hours) signed with `DEMO_SESSION_SECRET` (at least 16 characters). Off unless `DEMO_MODE_ENABLED` is `true` or `1`. The session is read-only fictional data and does not construct a Supabase client. `/settings`, `/automations`, and `/email` redirect to `/leads`; blocked APIs return `403` with `code: "demo_readonly"`.
- Public ingest (`POST /api/ingest/lead`, `POST /api/ingest/n8n`) is bearer-token protected (`INGEST_SECRET`); report auth bypasses as high severity.
- Transactional email (Resend) is fail-open by design — the lead is saved even if email fails. Do not report that as a bug.
