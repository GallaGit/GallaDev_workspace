# Diagrams

The checked-in architecture diagram (Notion, `NotionLeadRepository`, `src/middleware.ts`) is historical. It lives in [`docs/archive/diagrams-notion-era/`](../archive/diagrams-notion-era/README.md).

Current shape, verified in code: browser → Next.js UI → route handlers → `getSessionLeadRepository()` (`DemoLeadRepository` for a visitor, otherwise `SupabaseLeadRepository`) → Supabase. The gate is `src/proxy.ts`, with a second RBAC check in route handlers (`requireApiSession` / `requireApiRole`).
