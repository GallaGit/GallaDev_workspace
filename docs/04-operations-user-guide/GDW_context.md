# Operations And User Guide

## Requirements and setup

- Node.js 22 (matches CI).
- npm.
- A Supabase project with the required migrations applied.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` in `.env.local`, plus `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (same public URL and publishable key; Next inlines them at build time). Use `AUTH_DISABLED=true` only for local development. Never commit credentials. There is no self-signup: an Admin creates accounts in the Supabase Dashboard (Authentication → Users). The `on_auth_user_created` trigger assigns Seller.

## Main routes

- `/`: dashboard (Daily Work KPIs).
- `/leads`: lead list, filters (including **Mis leads**), detail drawer, assignee, and manual creation.
- `/inbox`: Daily Work queues.
- `/kanban`: the nine pipeline states. There is no inline “add card” control.
- `/stats`: statistics. Chart type selector: Barras, Circular (donut), Área (`localStorage` key `gdw-stats-chart-type`).
- `/duplicates`: duplicate groups.
- `/email`: draft review and Gmail Compose support. Visitors are redirected to `/leads`.
- `/automations`: automation webhooks. Visitors are redirected to `/leads`.
- `/settings`: integration status, security, and masked configuration. Visitors are redirected to `/leads`.

## Daily operation

New leads enter the `Nuevo` queue. Users can search by company, domain, email, city, province, or LinkedIn; combine filters; edit notes and email drafts; change status; archive records; and manage duplicates. The application saves changes to Supabase.

## Roles and AI limits

The role comes from `profiles.role` (PostgreSQL enum `app_role`): Admin, Seller, or Viewer.

- **Admin:** settings and automation mutations, `GET /api/team`, lead writes, and AI analysis.
- **Seller:** lead writes and AI analysis (subject to the rate limit). Cannot change settings or automations, and cannot list the team.
- **Viewer:** read-only. Write APIs return 403.

AI analysis (`POST /api/leads/:id/analyze` and `POST /api/leads/pain-analysis`) allows 10 requests / 60s per session user (in-memory limit). It uses the authenticated session and RLS; normal user requests do not use the privileged `service_role`.

Uptime check: `GET /api/health` (no session). It returns `{"ok":true}` when the process answers HTTP. It does not check Supabase.

## Visitor demo

The login page can offer **Entrar como visitante** / “Ver demo sin cuenta”. The session is an HMAC-SHA256 httpOnly cookie (`gdw_visitor`, 4 hours) signed with `DEMO_SESSION_SECRET`. It is not an Admin, Seller, or Viewer, and it never opens the Supabase lead repository or the service-role client. `getSessionLeadRepository()` returns `DemoLeadRepository`. The UI shows fictional Spanish asesorías (`example.com` emails). A few leads include a pre-written pain analysis so the drawer can show it without calling a model. Kanban moves show a Spanish toast and are not saved. Pages `/settings`, `/automations`, and `/email` redirect to `/leads`. Blocked APIs (team, settings, automations, db-status, ingest, lead writes, merge, score, and live AI) return HTTP 403 with `code: "demo_readonly"`. `GET /api/session` returns `visitor: true` and `role: null`. `POST /api/demo/enter` returns 404 `demo_disabled` when the flag is off, 503 `demo_misconfigured` when the secret is missing or shorter than 16 characters, and 429 `rate_limited` after 8 requests in 15 minutes per IP. Demo responses send `X-Robots-Tag: noindex, nofollow` (the app layout is already `noindex`).

| Variable | Role |
| --- | --- |
| `DEMO_MODE_ENABLED` | `true` or `1` turns the demo on. **Unset, empty, or anything else is off.** |
| `DEMO_SESSION_SECRET` | HMAC secret, at least 16 characters. Required while the flag is on. Generate with `openssl rand -hex 32`. |

To disable in production without a code change, set `DEMO_MODE_ENABLED=false` or remove it, then redeploy/restart so the process picks up the env. Entry is rate-limited (8 requests / 15 minutes / IP). The Playwright server sets the flag only for E2E; production stays off until you set the variables.

## Errors and logs

`src/app/error.tsx` and `src/app/global-error.tsx` render a fallback with retry and a link home (`global-error` covers a failure in the root layout). Ingest and analyze catches log one JSON line through `src/lib/route-log.ts`. Fields: `route`, `errorClass`, `status` when set, and `requestId` when the request already carried a safe `x-request-id` or `x-vercel-id`. Optional `leadId`. No request bodies, tokens, or personal data.

## Troubleshooting

- If login fails or the browser reports a network error, check `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`, and confirm `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` were present at **build** time. Next does not inject those public vars into the client unless the access is a static `process.env.NEXT_PUBLIC_*` read, and a rebuild is required after they change.
- If an authenticated user gets HTTP 401 with `code: "no_profile"`, that Auth user has no `profiles` row, or `profiles.role` is not `Admin`, `Seller`, or `Viewer`. The trigger should insert Seller; set Admin with `UPDATE public.profiles SET role = 'Admin' WHERE id = '<user id>'`.
- **Cerrar todas las sesiones** calls `supabase.auth.signOut({ scope: "global" })`. The app has no `POST /api/auth/logout-all` and does not consult `app_session_epoch`. A 503 on `POST /api/demo/enter` means the demo flag is on and `DEMO_SESSION_SECRET` is missing or too short (`demo_misconfigured`), not a session-epoch failure.
- Visitor pages `/settings`, `/automations`, and `/email` redirect to `/leads`. The matching APIs return 403 `demo_readonly`. `GET /api/session` includes `visitor: true` for that cookie.
- If an integration fails, inspect Settings status and server logs without exposing credentials.
- If TypeScript or build checks fail, resolve the code/schema mismatch before treating the roadmap item as complete.

## Quality commands

```bash
npm run lint
npx tsc --noEmit
npm run test:unit
npm run test:component
npm run build
npm run test:e2e
```

Playwright starts `npm run start` itself (`playwright.config.ts`), so run `npm run build` first. CI does that build before `npm run test:e2e`.
