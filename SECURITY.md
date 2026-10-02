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

- Auth is Supabase Auth (email + password). Roles `Admin`, `Seller`, and `Viewer` come from `profiles.role`. An authenticated user with no profile row, a null role, or a role outside that enum is denied (`401`, `code: "no_profile"`) and the app shows a pending-access screen. There is no self-signup: keep public sign-up disabled in the Supabase dashboard. An Admin creates users in Authentication → Users; `on_auth_user_created` inserts a profile with **no role**. The Admin assigns `Admin`, `Seller`, or `Viewer` in Settings → Equipo (`PATCH /api/team`). Existing rows are not changed by that migration.
- Lead RLS: Admin reads and writes every lead, including unassigned ones, and assigns `responsable`. Seller reads and writes only leads where `responsable` is their user id (they cannot clear it or pass it to someone else). Viewer is read-only on the whole book, including unassigned leads — that is the product role for a trusted read-only teammate on this single-team workspace. There is no manager role. The same predicate is enforced in the lead API (list, get, patch, archive, merge, score, and the status change to Cliente).
- Company mail HTML is sanitized with `sanitize-html` before it is stored and again before it is returned. The thread view renders it in a sandboxed iframe (`sandbox` without `allow-scripts`, `srcdoc`). Remote images, `data:` URLs, scripts, event handlers, forms, and inline styles are removed. Production CSP is set per request in `src/proxy.ts`: `script-src` uses a nonce and `'strict-dynamic'` and does not include `'unsafe-inline'`. `style-src` still allows `'unsafe-inline'` (no style nonce) because the UI sets style attributes. `img-src` is `'self' blob:` only. `connect-src` still allows `https:` and `wss:` so the browser can reach Supabase.
- `AUTH_DISABLED=true` (or `1`) skips session checks only outside production. In production it is fail-closed: `NODE_ENV=production` keeps auth on. `AUTH_SECRET`, `AUTH_PASSWORD`, and `SESSION_TTL_DAYS` are not used.
- **Cerrar todas las sesiones** (Settings → Seguridad) calls `supabase.auth.signOut({ scope: "global" })`. The sidebar logout calls `supabase.auth.signOut()` with no scope argument. There is no `POST /api/auth/logout-all` and the app does not read `app_session_epoch`.
- Visitor demo: an HMAC-SHA256 httpOnly cookie (`gdw_visitor`, 4 hours) signed with `DEMO_SESSION_SECRET` (at least 16 characters). Off unless `DEMO_MODE_ENABLED` is `true` or `1`. The session is read-only fictional data and does not construct a Supabase client. The proxy allowlists visitor routes (`/`, `/leads`, `/kanban`, `/stats`, `/inbox`, `/duplicates`, and read APIs for leads, session, and sync). Anything else redirects to `/leads` or returns `403` with `code: "demo_readonly"`. Production must use its own random secret (`openssl rand -hex 32`), not a CI value. Playwright uses the GitHub Actions secret `E2E_DEMO_SESSION_SECRET` when it is set and at least 16 characters; otherwise it generates a process-local value. CI stays green without that secret.
- Sign-in is `POST /api/auth/login` (the browser does not call `signInWithPassword`). Failures share one message. The limit is 20 attempts / 15 minutes per platform IP and 10 / 15 minutes per account (`consumeRateLimit`: Upstash when `UPSTASH_REDIS_REST_*` is set, otherwise in-memory per instance).
- `GET /api/db-status` uses the session client and RLS. The JSON status is `ok`, `auth`, `config`, or `down`, with a fixed message. It does not return Postgres text and it does not use the service role.
- `handle_new_user()` is not an RPC. Migration `20261002200000_revoke_handle_new_user_execute.sql` revokes `EXECUTE` from `PUBLIC`, `anon`, and `authenticated`. Apply it in the Supabase SQL editor; it does not change existing rows. The signup trigger still runs as the function owner.
- Company mail compose, reply, draft, and thread patch share one schema: max lengths, UUID for ids, and a mailbox on the allowlist. A reply checks the stored recipient again before send and refuses a mailbox outside that list.
- Public ingest: `POST /api/ingest/lead` uses `INGEST_SECRET`. `POST /api/ingest/n8n` uses `N8N_INGEST_SECRET` when that variable is set to a different value. If it is unset, n8n still accepts `INGEST_SECRET` so an existing workflow keeps working; set the dedicated secret to separate the two. Report auth bypasses as high severity.
- Outbound n8n URLs must be https, without userinfo, and must not target loopback, link-local, private, or cloud-metadata hosts. `N8N_ALLOWED_HOSTS` pins the allowed hosts. The automation test response returns the HTTP status only.
- Rate limits use `x-vercel-forwarded-for` (else the last `x-forwarded-for` hop). `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` make the counter shared; without them each instance has its own window. Web ingest also caps receipt emails per day, independent of IP.
- Transactional email (Resend) is fail-open by design — the lead is saved even if email fails. Do not report that as a bug.
