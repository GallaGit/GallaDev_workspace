# Architecture And Integrations

## Runtime architecture

The application uses Next.js App Router. The browser calls server route handlers; domain repositories isolate the UI from persistence. Supabase PostgreSQL is the current source of truth for leads and activity. Secrets stay on the server.

```text
Browser -> Next.js UI -> Route handlers -> Lead repository -> Supabase
                                           -> Settings service
                                           -> Optional automation provider
```

## Persistence and security

- Leads and activities live in Supabase.
- `getLeadRepository()` returns `SupabaseLeadRepository` (service role without a client; the session client when one is passed, so RLS applies).
- `getSessionLeadRepository()` returns `DemoLeadRepository` for a valid visitor cookie (in-memory fictional leads, no Supabase client) and otherwise the session repository. `AUTH_DISABLED` (non-production only) uses the service-role repository.
- `src/proxy.ts` is the session gate (Next.js 16 `proxy`; there is no `src/middleware.ts`). It exempts `/api/health`, `/api/demo/enter`, `/api/demo/exit`, and `/api/ingest/*`.
- Route handlers add an RBAC layer: `requireApiSession`, `requireApiRole`, `requireAdmin`, and `requireLeadWriter`. Roles are `profiles.role` (`Admin`, `Seller`, `Viewer`).
- Row-level security is the boundary for user data isolation.
- Settings expose masked previews and never return complete secrets.
- n8n dispatch failures do not fail lead persistence.

## Integrations

- **Supabase:** active database and source of truth.
- **n8n:** optional prospecting and automation provider.
- **SerpAPI:** external search used by the prospecting workflow.
- **Groq:** web extraction, email generation, and lead pain analysis.
- **Resend:** transactional notifications for web ingestion.

## Ingestion contract

Any source may create a lead with state `Nuevo` and an `Origen` such as `n8n`, `web-galladev`, or `Manual`. The CRM qualifies all sources identically. CRM-to-automation notifications are disabled by default, best-effort, and never block persistence.

## Historical Notion integration

Notion was the former source of truth. The runtime has been removed; the migration script remains in `docs/archive/` for historical reference only. Notion IDs and property mappings in old notes must not be interpreted as current runtime configuration.

## Main API surface

- `GET/POST/PATCH /api/leads` (bulk PATCH on the collection)
- `GET/PATCH/DELETE /api/leads/:id`
- `POST /api/leads/:id/analyze`
- `GET /api/leads/duplicates`
- `POST /api/leads/merge`
- `POST /api/leads/score`
- `POST /api/leads/pain-analysis`
- `POST /api/sync`
- `GET /api/health` (liveness, no session, no database)
- `GET /api/db-status` (session; Supabase connectivity)
- `GET /api/session` (`visitor: true` for a visitor cookie)
- `GET /api/team` (Admin)
- `POST /api/demo/enter` (404 `demo_disabled`, 503 `demo_misconfigured`, 429 `rate_limited`)
- `POST /api/demo/exit`
- `GET/PATCH /api/settings`
- `GET /api/settings/status`
- `POST /api/settings/test`
- `GET /api/automations`
- `GET/PATCH/POST /api/automations/:action`
- `POST /api/ingest/lead`
- `POST /api/ingest/n8n`
