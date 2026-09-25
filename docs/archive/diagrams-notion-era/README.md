# Architecture diagrams (historical)

These Archify artifacts were generated against `GallaGit/Leads_CRM` at revision `d8d943b`. They still show **Notion** as the source of truth, `NotionLeadRepository`, and `src/middleware.ts`.

They are not the current architecture. On `master`:

- Supabase is the only lead store (`SupabaseLeadRepository`).
- The session gate is `src/proxy.ts` (Next.js 16 `proxy`; `middleware` is deprecated).
- A visitor cookie resolves to `DemoLeadRepository` (`getSessionLeadRepository()`), which does not open Supabase.

The PNG contact-sheet images belong with `leads-crm-architecture.visual-check.html` in this folder. Do not treat them as a picture of production.
