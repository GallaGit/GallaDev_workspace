# History And Maintenance

## Historical sessions

This context consolidates the former dated session notes. Dates remain useful for traceability, but the entries are historical and do not override current code or Supabase behavior.

### 2026-09-04: development pass

Recorded the development baseline, product decisions, and the transition from a local single-user workspace toward staged SaaS validation.

### 2026-09-12: dark mode fix

Recorded the dark-mode correction and the visual verification needed after changing shared theme and layout behavior.

### 2026-09-12: compact lead filters

Recorded the compact lead-filter layout work and the responsive behavior expected by the Leads screen.

## Archive policy

Historical scripts are retained only when they help explain a migration or recovery path. `docs/archive/migrate-notion-to-supabase.mts` is not part of the runtime and must not be wired into package scripts without a deliberate review.

## Maintenance rules

- Update both language files when changing canonical product context.
- Keep current behavior separate from historical decisions.
- Link generated diagrams from architecture context instead of duplicating them as prose.
- Do not store secrets, tokens, or production data in documentation.
