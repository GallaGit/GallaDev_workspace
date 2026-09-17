# GallaDev Workspace

CRM for reviewing, qualifying, and managing leads for asesorías y gestorías. **Supabase (PostgreSQL) is the source of truth** (Notion is legacy, only when `LEADS_DB_PROVIDER=notion`); n8n handles prospecting.

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

> Legacy Notion deployments only: `LEADS_DB_PROVIDER=notion` plus `NOTION_TOKEN`, `NOTION_DATABASE_ID`, `NOTION_DATA_SOURCE_ID`.

## Documentation

- [Documentation index](./docs/README.md)
- [Business context](./docs/product/CONTEXTO_NEGOCIO.md)
- [Product decisions](./docs/product/DECISIONES.md)
- [Setup & usage guide](./docs/guides/GUIA_USO.md)
- [Architecture](./docs/architecture/ARQUITECTURA.md)
- [Integrations](./docs/architecture/INTEGRACIONES.md)
- [Implementation status](./docs/architecture/ESTADO_IMPLEMENTACION.md)
- [Roadmap](./docs/product/ROADMAP.md)

## Stack

Next.js App Router, React, TypeScript, Tailwind CSS, Lucide, TanStack Query, Zustand, Supabase (`@supabase/ssr`, `@supabase/supabase-js`), `@notionhq/client` (legacy), Resend, Groq.

## Verification

```bash
npm run lint
npx tsc --noEmit
npm run test:unit
npm run test:component
npm run build
```

See [Testing](./TESTING.md) and [Implementation status](./docs/architecture/ESTADO_IMPLEMENTACION.md) before assuming roadmap sections are complete.

## Web ingest emails

After a successful `POST /api/ingest/lead` (created or deduped), the app sends with Resend:

- Receipt to the visitor (`email` from the payload)
- Internal notice to `EMAIL_NOTIFY_TO`

Fail-open: if the key is missing or Resend fails, the lead **is still saved** and the API answers 201/200.

Variables (names; values in Vercel, never in git): `RESEND_API_KEY`, `EMAIL_FROM_CLIENTS`, `EMAIL_NOTIFY_TO`, optional `EMAIL_REPLY_TO`.

Not used for marketing or nurturing lists.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for branches, commits, tests, and the PR process. By participating you agree to our [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md); report vulnerabilities privately per [`SECURITY.md`](./SECURITY.md).
