# Audit Trail (Who Did What) — Future Requirement

> **Status:** specified, not implemented · **Date:** 2026-09-22
> **Prerequisite:** Paso 2 slice SaaS (per-user identity via Supabase Auth).
> Do not present this as current behavior: today the app has a single shared
> session and cannot attribute actions to a person.

## 1. Goal

With more than one user in the workspace, it must be possible to answer
"who did what, when": state changes, notes, emails, archiving, merges,
AI analysis, reassignments, settings changes, and logins. This is an
operational and trust requirement for team work, and a precondition for
any future billing or per-user SLA reporting.

## 2. Scope (when implemented)

Recorded per event:

- **actor**: `auth.users.id` + email + role at event time
- **action**: e.g. `lead.status_changed`, `lead.note_edited`,
  `lead.email_marked`, `lead.archived`, `lead.merged`,
  `lead.ai_analyzed`, `lead.reassigned`, `settings.changed`,
  `auth.login`, `auth.logout`
- **entity**: table + row id (lead id, etc.)
- **before/after**: minimal diff (old value → new value), never secrets
- **at**: server timestamp

Out of scope for the first version: real-time feed, export, retention
policies beyond a documented default, and per-organization scoping UI
(see §5).

## 3. Planned design

- New table `public.audit_log` (append-only; no UPDATE/DELETE policies
  for app roles, inserts server-side only).
- Columns include `actor_id uuid REFERENCES auth.users(id)`,
  `actor_email text`, `actor_role app_role`, `action text`,
  `entity_table text`, `entity_id uuid`, `diff jsonb`,
  `org_id uuid NULL` (reserved for future multi-company; see §5),
  `created_at timestamptz DEFAULT now()`.
- RLS: Admin reads everything; Seller/Viewer read events on leads
  visible to them (same visibility rule as `leads`); nobody edits.
- Writes happen in the API routes after a successful mutation, using
  the session user from `requireApiSession` (never trust a client-sent
  actor). Fail-open for reads, fail-closed for writes: a logging
  failure must not silently drop the business mutation, but it must be
  surfaced (structured log + Sentry when available).
- UI: per-lead timeline entry ("who did what") reusing the existing
  activity timeline, plus an Admin-only global view with filters
  (actor, action, date range). No new design system; Linear-compact
  lists as elsewhere.

## 4. Acceptance criteria (future)

- Every mutation in §2 creates exactly one `audit_log` row with a
  correct actor, including actions performed via bulk PATCH and merge.
- An Admin can list events filtered by actor/action/date; a Seller
  cannot see events on leads outside their visibility.
- Direct PostgREST writes to `audit_log` with an app-role key are
  rejected (append-only enforced by RLS).
- Automated tests cover actor attribution for status change, note
  edit, and reassignment.

## 5. Multi-company note

If the workspace ever serves external companies, `org_id` scopes
events per organization (Model A: shared DB + tenant column) or each
company's own database carries its own `audit_log` (Model B: one
project per company, same migrations). No decision needed now; the
nullable column keeps both paths open.
