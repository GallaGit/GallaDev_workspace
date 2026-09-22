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
- `getLeadRepository()` selects the active repository implementation.
- Authentication and middleware protect sensitive routes.
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

- `GET/POST/PATCH/DELETE /api/leads`
- `GET/PATCH /api/leads/:id`
- `POST /api/leads/:id/analyze`
- `POST /api/sync`
- `GET/PATCH /api/settings`
- `GET/PATCH/POST /api/automations/:action`
- `POST /api/ingest/lead`
- `POST /api/ingest/n8n`
