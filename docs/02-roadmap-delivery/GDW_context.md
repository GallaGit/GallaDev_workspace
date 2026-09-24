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
- Remaining M1 items: hygiene (LICENSE, secret scanning, Dependabot, CodeQL).

### Planned: audit trail (specified, not implemented)

Who-did-what history for team work is specified in
[`audit-trail.md`](./audit-trail.md) (ES: [`audit-trail.es.md`](./audit-trail.es.md)).
Prerequisite is Paso 2 per-user identity; implementation comes after the
second-user validation gate.

## Delivery rules

Work is isolated with branches and environments, not repository copies. Product changes must update the canonical context and remain aligned with the code and database schema. Historical verification reports are evidence from their date, not guarantees about the current build.

## Acceptance evidence

Before calling a milestone complete, verify the relevant lint, TypeScript, unit, component, build, authentication, and RLS checks. Record failures and environment assumptions explicitly. Do not promote a future roadmap item to current behavior without code and verification evidence.
