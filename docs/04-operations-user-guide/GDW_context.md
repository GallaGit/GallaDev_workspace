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

## Visitor demo

The login page can offer **Entrar como visitante** / “Ver demo sin cuenta”. The session is a signed httpOnly cookie (`gdw_visitor`, 4 hours). It is not an Admin, Seller, or Viewer, and it never opens the Supabase lead repository or the service-role client. The UI shows about twenty fictional Spanish asesorías (`example.com` emails). A few leads include a pre-written pain analysis so the drawer can show it without calling a model. Kanban moves show a Spanish toast and are not saved. Settings, automations, team, ingest, the email page, and live AI analysis are blocked (HTTP 403). Demo responses send `X-Robots-Tag: noindex, nofollow` (the app layout is already `noindex`).

| Variable | Role |
| --- | --- |
| `DEMO_MODE_ENABLED` | `true` or `1` turns the demo on. **Unset, empty, or anything else is off.** |
| `DEMO_SESSION_SECRET` | HMAC secret, at least 16 characters. Required while the flag is on. Generate with `openssl rand -hex 32`. |

To disable in production without a code change, set `DEMO_MODE_ENABLED=false` or remove it, then redeploy/restart so the process picks up the env. Entry is rate-limited (8 requests / 15 minutes / IP). The Playwright server sets the flag only for E2E; production stays off until you set the variables.

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
