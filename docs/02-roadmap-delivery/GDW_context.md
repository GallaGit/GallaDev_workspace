# Roadmap And Delivery

## Delivery sequence

- **M1 Secure:** authentication, session invalidation, rate limits, body caps, security headers, and row-level isolation.
- **Minimum SaaS validation:** a second user completes the core workflow without seeing another user's leads.
- **M2 Solid:** broader tests, CI gates, observability, error handling, and documentation hardening.
- **M3 Commercial SaaS:** billing, first-party automation, realtime, and scale capabilities.

Optional enrichment checklist from bootcamp themes — does not replace this sequence: [`bootcamp-enrichment.es.md`](./bootcamp-enrichment.es.md).

## Current state

Supabase is the active persistence layer and sole source of truth. The current application includes leads, Kanban, email, Daily Work, statistics, duplicates, settings, Supabase Auth with RBAC (Admin, Seller, Viewer), ingestion endpoints, and AI analysis. n8n integrations are optional and best-effort. There is no self-signup.

### M1 security baseline (2026-09-22)

- Explicit session checks on sensitive API routes (`requireApiSession`; 401 without session in production).
- **Superseded (PR #37):** “`AUTH_SECRET` mandatory in production” no longer applies. Sign-in is Supabase Auth (email + password). `AUTH_SECRET`, `AUTH_PASSWORD`, and `SESSION_TTL_DAYS` are not read. `AUTH_DISABLED` is fail-closed in production.
- Security headers (HSTS, CSP, frame/content-type/referrer/permissions).
- Shared in-memory rate limiter on public ingest, AI analysis (10 / 60s per user), and `POST /api/demo/enter` (8 / 15 min per IP), plus body caps on ingest and bulk PATCH. Login is not rate-limited in this app. The limiter is per instance, not distributed.
- Role-based RLS migration applied in Supabase (`app_role`: Admin/Seller/Viewer; `profiles.role`; per-role policies on `leads`/`lead_activities`).
- `zod` validation on lead PATCH bodies (`PATCH /api/leads/:id` and bulk PATCH).
- Hygiene done: MIT `LICENSE`, Dependabot (npm and GitHub Actions; opens PRs, does not merge them), and secret scanning with push protection (enabled).
- Dependabot ignores semver-major updates and groups updates weekly.
- Remaining M1 hygiene: **CodeQL only**. The repository is public, so GitHub’s default CodeQL setup does not require Advanced Security. There is still no CodeQL workflow, and CodeQL is not a required status check.

### M1 close / post-M1 in production (2026-09-24)

Production: `https://workspace.galladev.com`. `GET /api/health` returns `{"ok":true}` (the process answers HTTP; no session and no database).

- **RBAC High** (PR #44): settings and automation mutations are Admin-only; lead writes and AI analysis are Admin or Seller; Viewer gets 403 on writes. `GET /api/team` is Admin-only. AI analysis uses the authenticated session (RLS), not `service_role` for normal user requests, with a cap of 10 requests / 60s. The UI gates actions from the session role.
- **Kanban, Statistics, and release hygiene** (PR #43): removed the dead Kanban “+ add card” control (it did not persist); Statistics chart-type selector (bars / donut / area); `GET /api/health`; MIT `LICENSE`; Dependabot.
- **M2 Slice 1 — CI gates on `master` (PR #53):** required and strict, with `enforce_admins` on: Lint & TypeCheck, Unit Tests, Component Tests, E2E Tests. CodeQL is not a required check. Required reviews are not above 0.

### M2 Slice 2 (PR #54, done)

- Ingest tests for `POST /api/ingest/lead` and `POST /api/ingest/n8n`: 401 without a valid bearer, 429 from the in-memory limiter, 413 when the body exceeds the cap.
- `src/app/error.tsx` and `src/app/global-error.tsx` (retry / home). No Sentry SDK in the repo.
- Structured logs via `src/lib/route-log.ts` on ingest and analyze catches: JSON fields `route`, `status` when set, `errorClass`, `requestId` when a safe header id is already present.

### Visitor demo (PR #55, done, 2026-09-25)

Passwordless demo for recruiters and reviewers. `DEMO_MODE_ENABLED` defaults **off** when unset. When it is `true` or `1` and `DEMO_SESSION_SECRET` is set (at least 16 characters), the login page offers “Entrar como visitante”. An HMAC-signed httpOnly cookie (4 hours) resolves server-side through `getSessionLeadRepository()` to `DemoLeadRepository` (in-memory fictional leads). Visitor requests do not construct the Supabase session client or the service-role repository. Pages `/settings`, `/automations`, and `/email` redirect to `/leads`. Blocked APIs return 403 `demo_readonly`. `POST /api/demo/enter` returns 404 `demo_disabled`, 503 `demo_misconfigured`, or 429. `GET /api/session` returns `visitor: true`. Canned pain analyses ship on a few fictional leads. Turn the demo off by setting `DEMO_MODE_ENABLED=false` or removing the variable (no code change). See the operations guide.

### M2 pending

- **CodeQL** (also the last M1 hygiene item). Not a required check. Public repo: default setup does not need Advanced Security.
- **Viewer E2E 403 tests.** CI E2E credentials are Admin and Seller only (`E2E_ADMIN_*`, `E2E_SELLER_*`, plus `E2E_TEST_*`). There is no Viewer secret, so the 403 write paths are covered by unit tests (`src/lib/auth/rbac-routes.test.ts`) and not by Playwright.
- **Distributed rate limiting.** `src/lib/rate-limit.ts` is an in-memory map per instance. It is not shared across serverless instances.
- **Audit trail.** Specified, not implemented. See below.

### Planned: audit trail (specified, not implemented)

Who-did-what history for team work is specified in
[`audit-trail.md`](./audit-trail.md) (ES: [`audit-trail.es.md`](./audit-trail.es.md)).
Per-user identity (Supabase Auth + `profiles.role`) is in place. The audit log itself is not. Do not treat it as current behavior.

### Proposed — pending validation

- **Client portal (project trace).** Specified, not implemented, and not part of M2. Spanish spec: [`client-portal.es.md`](./client-portal.es.md). When a lead becomes `Cliente`, a new `client` role (today `app_role` is only Admin, Seller, and Viewer) would see their project at `/portal`. Product decisions approved by Ociel on 26 Sep 2026.
- **Email management inside GDW** («Gestión de emails en la plataforma GDW»). Placeholder. Not specified. Not part of M2.

## Delivery rules

Work is isolated with branches and environments, not repository copies. Product changes must update the canonical context and remain aligned with the code and database schema. Historical verification reports are evidence from their date, not guarantees about the current build.

## Acceptance evidence

Before calling a milestone complete, verify the relevant lint, TypeScript, unit, component, build, authentication, and RLS checks. Record failures and environment assumptions explicitly. Do not promote a future roadmap item to current behavior without code and verification evidence.
