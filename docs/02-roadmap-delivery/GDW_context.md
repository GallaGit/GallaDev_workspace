# Roadmap And Delivery

## Delivery sequence

- **M1 Secure:** authentication, session invalidation, rate limits, body caps, security headers, and row-level isolation.
- **Minimum SaaS validation:** a second user completes the core workflow without seeing another user's leads.
- **M2 Solid:** broader tests, CI gates, observability, error handling, and documentation hardening.
- **M3 Commercial SaaS:** billing, first-party automation, realtime, and scale capabilities.

Optional enrichment checklist from bootcamp themes — does not replace this sequence: [`bootcamp-enrichment.es.md`](./bootcamp-enrichment.es.md).

## Current state

Supabase is the active persistence layer and sole source of truth. The current application includes leads, Kanban, email, Daily Work, statistics, duplicates, settings, authentication scaffolding, ingestion endpoints, and AI analysis. n8n integrations are optional and best-effort.

### M1 security baseline (2026-09-22)

- Explicit session checks on 14 sensitive API routes (`requireApiSession`; 401 without session in production).
- `AUTH_SECRET` mandatory in production; no fallback secret.
- Security headers (HSTS, CSP, frame/content-type/referrer/permissions).
- Shared in-memory rate limiter + body caps on ingest, login, and bulk PATCH.
- Role-based RLS migration applied in Supabase (`app_role`: Admin/Seller/Viewer; `profiles` table; per-role policies on `leads`/`lead_activities`).
- `zod` validation on lead PATCH bodies (`PATCH /api/leads/:id` and bulk PATCH).
- Hygiene done: MIT `LICENSE` and Dependabot (npm and GitHub Actions; opens PRs, does not merge them).
- Remaining M1 items: secret scanning and CodeQL.

### M1 close / post-M1 in production (2026-09-24)

Production: `https://workspace.galladev.com`. `GET /api/health` returns `{"ok":true}` (the process answers HTTP; no session and no database).

- **RBAC High** (PR #44): settings and automation mutations are Admin-only; lead writes and AI analysis are Admin or Seller; Viewer gets 403 on writes. `GET /api/team` is Admin-only. AI analysis uses the authenticated session (RLS), not `service_role` for normal user requests, with a cap of 10 requests / 60s. The UI gates actions from the session role.
- **Kanban, Statistics, and release hygiene** (PR #43): removed the dead Kanban “+ add card” control (it did not persist); Statistics chart-type selector (bars / donut / area); `GET /api/health`; MIT `LICENSE`; Dependabot.
- **M2 Slice 1 — CI gates on `master`:** required and strict, with `enforce_admins` on: Lint & TypeCheck, Unit Tests, Component Tests, E2E Tests. CodeQL is not a required check. Required reviews are not above 0.

### Visitor demo (2026-09-25)

Passwordless demo for recruiters and reviewers. `DEMO_MODE_ENABLED` defaults **off** when unset. When it is `true` or `1` and `DEMO_SESSION_SECRET` is set (at least 16 characters), the login page offers “Entrar como visitante”. A signed httpOnly cookie (4 hours) resolves server-side to an in-memory fictional `LeadRepository`. Visitor requests do not construct the Supabase session client or the service-role repository. Writes, settings, automations, team, ingest, email, and live AI analysis return 403. Canned pain analyses ship on a few fictional leads. Turn the demo off by setting `DEMO_MODE_ENABLED=false` or removing the variable (no code change). See the operations guide.

### Planned: audit trail (specified, not implemented)

Who-did-what history for team work is specified in
[`audit-trail.md`](./audit-trail.md) (ES: [`audit-trail.es.md`](./audit-trail.es.md)).
Prerequisite is Paso 2 per-user identity; implementation comes after the
second-user validation gate.

## Delivery rules

Work is isolated with branches and environments, not repository copies. Product changes must update the canonical context and remain aligned with the code and database schema. Historical verification reports are evidence from their date, not guarantees about the current build.

## Acceptance evidence

Before calling a milestone complete, verify the relevant lint, TypeScript, unit, component, build, authentication, and RLS checks. Record failures and environment assumptions explicitly. Do not promote a future roadmap item to current behavior without code and verification evidence.
