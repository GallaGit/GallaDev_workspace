# Audit Trail (Who Did What)

> **Status:** implemented (first and second delivery) · **Updated:** 2026-11-28
> **Migrations:** `20261024120000_audit_log.sql` (table) and
> `20261128120000_audit_log_hardening.sql` (hardening, columns and RLS).
> Ociel applies them by hand in production.
> The second delivery (Correo, merges and AI analysis) **adds no migration**
> (the `action` format check already accepts the new names).

## 1. Goal

With more than one user in the workspace, it must be possible to answer
"who did what, when": state changes, notes, emails, archiving, merges,
AI analysis, reassignments, settings changes, and logins. This is an
operational and trust requirement for team work, and a precondition for
any future billing or per-user SLA reporting.

## 2. What is recorded today (first delivery)

| Action (`action`) | Source | Diff |
| --- | --- | --- |
| `lead.created` | `POST /api/leads` | field names |
| `lead.status_changed` | `PATCH /api/leads/:id` and `PATCH /api/leads` (bulk) | status before→after |
| `lead.reassigned` | same | owner before→after |
| `lead.note_edited` | same (`notes`/`notesOverflow`) | field name only |
| `lead.updated` | same (other fields) | safe fields before→after; others by name only |
| `lead.archived` | `DELETE /api/leads/:id` | `["archived"]` |
| `team.role_changed` | `PATCH /api/team` | role before→after |
| `settings.changed` | `PATCH /api/settings` | `ai.provider` and `ai.model` before→after; API keys by name only |
| `auth.login` | `POST /api/auth/login` (successful logins only) | empty |
| `auth.logout` | `POST /api/auth/logout` (sidebar and "sign out everywhere") | empty |
| `email.received` | `POST /api/email/inbound` (webhook; actor = system, null `actor_id`) | `meta`: `messageId`, subject (≤80 chars), attachment count |
| `email.replied` | `POST /api/email/threads/:id/reply` (only when sent) | `meta`: `messageId`, attachment count; thread `lead_id` |
| `email.linked` | `PATCH /api/email/threads/:id` with `lead_id` (link/unlink) | `["lead_id"]`, `meta.linked` |
| `email.archived` | `PATCH /api/email/threads/:id` and `PATCH /api/email/threads` (bulk) with `archived`/`trashed` | `meta.state`: `archived`, `unarchived`, `trashed`, `restored` |
| `lead.merged` | `POST /api/leads/merge` | filled fields by name; `meta.mergedIds` |
| `lead.ai_analyzed` | `runLeadAnalyze` (`/api/leads/:id/analyze` and `/api/leads/pain-analysis` with id) | `meta`: `model`, `success` |

Email events use `entity = email_thread` and `entity_id` = thread id; they
only fill `lead_id` when the thread is linked (so a Seller sees them in the
lead History). Bodies, attachment contents and email addresses are never
stored: only ids, a truncated subject and counts. The diff supports `meta`
(ids, counts, model name; never AI prompts or outputs). In the UI the webhook
actor is shown as "System". The Admin filter is by action, so the new actions
appear in the dropdown automatically. An AI analysis failure (provider error
or empty/invalid answer) records `success: false`.

Each row stores: `actor_id`, `actor_email`, `actor_role` (role at event
time), `action`, `entity`, `entity_id`, `lead_id` (lead events only), `diff`
and `created_at` (server time).

### Decisions

- **Action names:** `entity.verb` as in the spec (`lead.status_changed`).
  The closed CHECK was replaced by a format check
  (`^[a-z][a-z_]*(\.[a-z][a-z_]*)?$`), so legacy rows (`create`, `update`,
  `delete`, `role_change`) remain valid and the UI labels them.
- **One row per mutation:** if a PATCH mixes fields, the action follows the
  priority status > reassignment > note > other and the diff lists all
  fields. Bulk PATCH writes one row per lead.
- **Diff:** `{ "fields": [...], "changes": { field: { from, to } } }`.
  `changes` only exists for the closed `LEAD_SAFE_FIELDS` list (status,
  owner, favorite, archived, score, confidence, contact/follow-up dates),
  role and non-secret settings. Email, phone, notes, messages, keys and any
  other field store the field name only. Values are cut at 120 characters.
- **Server-only writes:** `logAudit` uses `createSupabaseAdminClient`
  (service_role) with the actor from `getApiSession`; it is never read from
  the request body. An insert failure is logged and does not roll back the
  mutation.
- **No auditing** for demo visitors or when `AUTH_DISABLED` is on.
- **Failed logins:** not recorded (out of this delivery).

## 3. Design

- `public.audit_log` is append-only: `anon` has no access; `authenticated`
  has `SELECT` only; `service_role` has `SELECT` and `INSERT` only. No
  insert policy.
- Read RLS: **Admin** reads everything; **Seller and Viewer** read events
  whose `lead_id` points to a lead they can see (the `EXISTS` over
  `public.leads` applies the same RLS as leads: Seller only their own,
  Viewer all); non-lead events (settings, login, roles) are Admin-only.
- API: `GET /api/leads/:id/history` (any signed-in role, filtered by RLS)
  and `GET /api/audit` (Admin only; filters `actor`, `action`, `from`, `to`,
  `page`; 25 per page).
- UI: a "History" section on the lead card (compact: who, what, when,
  before→after) and an Admin global view in Settings → "Change history"
  with user, action and date filters plus pagination. ES/EN i18n
  (`messages/*.json`, `audit` block).
- Owners are shown by email to Admin only; Seller and Viewer see "You" or
  "Someone else".

## 4. Acceptance criteria

- [x] Every mutation in §2 creates a row with the correct actor, including
  bulk PATCH (one per lead).
- [x] An Admin can list events filtered by actor/action/date; a Seller
  cannot see events on leads outside their visibility.
- [x] Direct PostgREST writes with an app-role key are rejected.
- [x] Tests: attribution for status change, note edit (field name only) and
  reassignment (`src/lib/audit/*.test.ts`), component
  (`src/components/audit`), migration and E2E against local Supabase
  (`tests/e2e/audit-trail.spec.ts`).
- [x] Correo, merges and AI analysis (second delivery; tests in `src/lib/audit/events.test.ts` and the route tests).

## 5. Multi-company note

If the workspace ever serves external companies, `org_id` scopes events per
organization (Model A: shared DB + tenant column) or each company's own
database carries its own `audit_log` (Model B: one project per company, same
migrations). No decision needed now; the nullable `org_id` column does
**not** exist yet and would be added by a migration if needed.

## 6. Out of scope

- Automatic thread linking (`autoLinkThread`, system) and `score` are not
  audited yet.
- Failed login attempts, export, real-time feed and a history retention
  policy remain out of scope.
