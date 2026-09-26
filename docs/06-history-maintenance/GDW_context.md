# History And Maintenance

## Historical sessions

This context consolidates the former dated session notes. Dates remain useful for traceability, but the entries are historical and do not override current code or Supabase behavior.

### 2026-09-04: development pass

Recorded the development baseline, product decisions, and the transition from a local single-user workspace toward staged SaaS validation.

### 2026-09-12: dark mode fix

Recorded the dark-mode correction and the visual verification needed after changing shared theme and layout behavior.

### 2026-09-12: compact lead filters

Recorded the compact lead-filter layout work and the responsive behavior expected by the Leads screen.

### Supabase cutover (PR #30)

Notion stopped being the runtime source of truth. Leads persist only in Supabase. The migration script stays in `docs/archive/` and is not wired into npm scripts.

### Supabase Auth (PR #37)

Email + password replaced the shared-password login. `AUTH_SECRET`, `AUTH_PASSWORD`, `SESSION_TTL_DAYS`, the session-epoch check, and `POST /api/auth/logout-all` are not part of the app. An Admin creates users in the Supabase Dashboard; `on_auth_user_created` assigns Seller. **Cerrar todas las sesiones** calls `supabase.auth.signOut({ scope: "global" })`.

### RBAC (PR #44)

Settings and automation mutations are Admin-only. Lead writes and AI analysis are Admin or Seller. Viewer writes return 403. `GET /api/team` is Admin-only.

### M2 slices (PR #53, PR #54)

Slice 1: Lint & TypeCheck, Unit Tests, Component Tests, and E2E Tests are required on `master`. Slice 2: ingest 401/429/413 tests, `error.tsx` / `global-error.tsx`, and JSON logs from `src/lib/route-log.ts` (`route`, `status`, `errorClass`, `requestId`).

### Visitor demo (PR #55)

Passwordless read-only session (HMAC httpOnly cookie, off by default). `getSessionLeadRepository()` returns `DemoLeadRepository`. Pages `/settings`, `/automations`, and `/email` redirect to `/leads`; blocked APIs return 403 `demo_readonly`.

## Archive policy

Historical scripts are retained only when they help explain a migration or recovery path. `docs/archive/migrate-notion-to-supabase.mts` is not part of the runtime and must not be wired into package scripts without a deliberate review.

## Maintenance rules

- Update both language files when changing canonical product context.
- Keep current behavior separate from historical decisions.
- Do not treat `docs/archive/diagrams-notion-era/` as current architecture (it still shows Notion and `src/middleware.ts`). Describe the live path in `docs/03-architecture-integrations/` instead of copying that diagram.
- Do not store secrets, tokens, or production data in documentation.
