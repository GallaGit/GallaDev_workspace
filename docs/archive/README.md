# Archive

Historical scripts and notes kept for reference. They are **not** part of the runtime and may not run against the current tree.

| Path | Notes |
|---|---|
| `migrate-notion-to-supabase.mts` | One-shot Notion → Supabase migration (Fase 1 v2.0). Depends on the removed `@notionhq/client` and `src/lib/notion/*`. Kept only as history; do not wire into `package.json`. |

Supabase (PostgreSQL) is the sole source of truth for leads. See `docs/architecture/INTEGRACIONES.md`.
