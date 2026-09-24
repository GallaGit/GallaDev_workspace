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

## Roles and AI limits

The role comes from `profiles.app_role`: Admin, Seller, or Viewer.

- **Admin:** settings and automation mutations, `GET /api/team`, lead writes, and AI analysis.
- **Seller:** lead writes and AI analysis (subject to the rate limit). Cannot change settings or automations, and cannot list the team.
- **Viewer:** read-only. Write APIs return 403.

AI analysis (`POST /api/leads/:id/analyze` and `POST /api/leads/pain-analysis`) allows 10 requests / 60s per session user (in-memory limit). It uses the authenticated session and RLS; normal user requests do not use the privileged `service_role`.

Uptime check: `GET /api/health` (no session). It returns `{"ok":true}` when the process answers HTTP. It does not check Supabase.

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
