# Security Policy

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

- Auth: production requires `AUTH_SECRET` + `AUTH_PASSWORD` with `SESSION_TTL_DAYS` 1–90. `AUTH_DISABLED=true` is local-dev only.
- Public ingest (`POST /api/ingest/lead`, `POST /api/ingest/n8n`) is bearer-token protected (`INGEST_SECRET`); report auth bypasses as high severity.
- Transactional email (Resend) is fail-open by design — the lead is saved even if email fails. Do not report that as a bug.
