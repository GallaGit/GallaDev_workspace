# Operations And User Guide

## Requirements and setup

- Node.js 20 or newer.
- npm.
- A Supabase project with the required migrations applied.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configure the Supabase URL and publishable/secret keys in `.env.local`. Use `AUTH_DISABLED=true` only for local development. Never commit credentials.

## Main routes

- `/leads`: lead list, filters, detail drawer, and manual creation.
- `/inbox`: Daily Work queues.
- `/kanban`: the nine pipeline states.
- `/email`: draft review and Gmail Compose support.
- Settings: integration status, security, and masked configuration.

## Daily operation

New leads enter the `Nuevo` queue. Users can search by company, domain, email, city, province, or LinkedIn; combine filters; edit notes and email drafts; change status; archive records; and manage duplicates. The application saves changes to Supabase.

## Troubleshooting

- If login or session invalidation returns 503, verify Supabase connectivity and that the session-epoch migration is applied.
- If an integration fails, inspect Settings status and server logs without exposing credentials.
- If TypeScript or build checks fail, resolve the code/schema mismatch before treating the roadmap item as complete.

## Quality commands

```bash
npm run lint
npx tsc --noEmit
npm run test:unit
npm run test:component
npm run build
```
