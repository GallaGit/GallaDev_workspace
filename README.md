# GallaDev Workspace

CRM for reviewing, qualifying, and managing leads for asesorías y gestorías. **Supabase (PostgreSQL) is the sole source of truth**; n8n handles prospecting. The Notion runtime has been removed.

> Formerly `Leads_CRM`. Production: [https://workspace.galladev.com](https://workspace.galladev.com).

## Quickstart

```bash
npm install
cp .env.example .env.local
# Set Supabase vars in .env.local (see below)
npm run dev
```

Open [http://localhost:3000/leads](http://localhost:3000/leads). The app syncs on load; you can also press **Sincronizar**.

Minimal config:

```dotenv
LEADS_DB_PROVIDER=supabase
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SECRET_KEY=<secret-key-never-commit>
AUTH_DISABLED=true
# Production: AUTH_SECRET + AUTH_PASSWORD. Session: SESSION_TTL_DAYS=1 (1–90).
```

## Documentation

- [Documentation overview](./docs/00-overview/GDW_context.md) ([español](./docs/00-overview/GDW_context.es.md))
- [Business and product context](./docs/01-business-product/GDW_context.md) ([español](./docs/01-business-product/GDW_context.es.md))
- [Roadmap and delivery](./docs/02-roadmap-delivery/GDW_context.md) ([español](./docs/02-roadmap-delivery/GDW_context.es.md))
- [Architecture and integrations](./docs/03-architecture-integrations/GDW_context.md) ([español](./docs/03-architecture-integrations/GDW_context.es.md))
- [Operations and user guide](./docs/04-operations-user-guide/GDW_context.md) ([español](./docs/04-operations-user-guide/GDW_context.es.md))
- [UX and AI contracts](./docs/05-ux-ai-contracts/GDW_context.md) ([español](./docs/05-ux-ai-contracts/GDW_context.es.md))
- [History and maintenance](./docs/06-history-maintenance/GDW_context.md) ([español](./docs/06-history-maintenance/GDW_context.es.md))

## Stack

Next.js App Router, React, TypeScript, Tailwind CSS, Lucide, TanStack Query, Zustand, Supabase (`@supabase/ssr`, `@supabase/supabase-js`), Resend, Groq.

## Verification

```bash
npm run lint
npx tsc --noEmit
npm run test:unit
npm run test:component
npm run build
```

See [Testing](./TESTING.md) and the [roadmap and delivery context](./docs/02-roadmap-delivery/GDW_context.md) before assuming roadmap sections are complete.

## Web ingest emails

After a successful `POST /api/ingest/lead` (created or deduped), the app sends with Resend:

- Receipt to the visitor (`email` from the payload)
- Internal notice to `EMAIL_NOTIFY_TO`

Fail-open: if the key is missing or Resend fails, the lead **is still saved** and the API answers 201/200.

Variables (names; values in Vercel, never in git): `RESEND_API_KEY`, `EMAIL_FROM_CLIENTS`, `EMAIL_NOTIFY_TO`, optional `EMAIL_REPLY_TO`.

Not used for marketing or nurturing lists.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) ([español](./CONTRIBUTING.es.md)) for branches, commits, tests, and the PR process. By participating you agree to our [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) ([español](./CODE_OF_CONDUCT.es.md)); report vulnerabilities privately per [`SECURITY.md`](./SECURITY.md) ([español](./SECURITY.es.md)).
