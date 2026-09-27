# “What it is” Section — Replaces The Visitor Demo

> **Status:** specified, not implemented · decision by Ociel, 26-27 Sep 2026 · **Updated:** 2026-09-27
> **Order:** first of the two slices decided on those days. Language follows: [`i18n.md`](./i18n.md) (ES: [`i18n.es.md`](./i18n.es.md)).
> Do not present this as current behavior. Login is still the form in `src/app/login/page.tsx`. The visitor demo (PR #55) is still in the code and **off**; it was never enabled in production. This slice removes it.

## 1. Decision

The visitor demo (“Entrar como visitante”, `gdw_visitor` cookie, `DEMO_MODE_ENABLED`, `DEMO_SESSION_SECRET`, read-only session with fictional leads) is **deprecated**.

The login page instead shows a public **What it is** section (ES: **Qué es**) on the same page, beside the form on wide screens or below it on narrow ones. Someone who only wants to understand the tool reads it with no account, no cookie, and no Supabase access.

Rationale: far simpler and cheaper than maintaining a read-only Supabase session, with no auth or data risk, and it serves anyone who just wants to understand the tool.

## 2. What is superseded

There is no open demo issue. These documentation lines are no longer pending work:

- Turning the demo on in production (`DEMO_MODE_ENABLED` / `DEMO_SESSION_SECRET`). Do not enable it. Production stays off, and this slice deletes the path.
- Visitor fixtures that were never added (for example Statistics, noted in the 2026-09-25 session log). Do not add them.
- “Portal inside the visitor demo” in [`client-portal.es.md`](./client-portal.es.md). There will be no demo to host it.

Demo code describes today’s tree until this slice lands. It is not the product plan.

## 3. What a signed-out visitor reads

The section does not replace the form. Email and password remain the CRM door. There is no public signup.

The approved copy is in both languages. Until the i18n slice, the page shows Spanish (the default). English ships in the same change, as this section’s copy, so the later switcher can turn it on without a rewrite. A control that only affects this page is acceptable if it does not compete with the global switcher; if it complicates login, English waits for the i18n slice.

### Spanish — title «Qué es»

GallaDev Workspace es un CRM para revisar, cualificar y gestionar leads de asesorías y gestorías.

Supabase (PostgreSQL) es la fuente de verdad. Los leads entran por la ingesta web o por un alta manual. El equipo los cualifica con un análisis de dolores por IA, los sigue en un Kanban, consulta estadísticas y trabaja con roles: Admin, Seller y Viewer.

Esta explicación se lee sin iniciar sesión. Entrar al CRM sigue pidiendo email y contraseña. No hay alta pública.

### English — title “What it is”

GallaDev Workspace is a CRM for reviewing, qualifying, and managing leads for asesorías y gestorías (advisory and accounting firms).

Supabase (PostgreSQL) is the source of truth. Leads come in through web ingest or manual entry. The team qualifies them with AI pain analysis, follows them on a Kanban board, reviews statistics, and works with roles: Admin, Seller, and Viewer.

This explanation can be read without signing in. CRM access still asks for email and password. There is no public signup.

## 4. Screenshots

A few static images, with captions. Fictional data only: invented firms, `example.com` emails, invented figures. Never a real lead or personal data.

Light theme at minimum. Each image has alt text that describes the screen, not the word “screenshot”.

| # | Planned file | Caption (ES) | Caption (EN) | Alt (ES) | Alt (EN) |
| --- | --- | --- | --- | --- | --- |
| 1 | `public/what-it-is/leads-light.webp` | **Lista de leads.** Empresas ficticias, con filtro y estado. No son clientes reales. | **Lead list.** Fictional companies, with a filter and a status. They are not real clients. | Lista de leads en tema claro: tres asesorías ficticias con estado y ciudad de ejemplo. | Light-theme lead list: three fictional advisory firms with sample status and city. |
| 2 | `public/what-it-is/kanban-light.webp` | **Kanban.** Los nueve estados del pipeline, de Nuevo a Cliente o Descartado, con tarjetas de ejemplo. | **Kanban.** The nine pipeline states, from Nuevo to Cliente or Descartado, with sample cards. | Tablero Kanban en tema claro con columnas del pipeline y tarjetas de empresas ficticias. | Light-theme Kanban board with pipeline columns and cards for fictional companies. |
| 3 | `public/what-it-is/stats-light.webp` | **Estadísticas.** Volumen y distribución del pipeline. Cifras inventadas. | **Statistics.** Pipeline volume and distribution. Invented figures. | Página de estadísticas en tema claro: gráfico de barras con cifras ficticias del pipeline. | Light-theme statistics page: a bar chart with fictional pipeline figures. |
| 4 | `public/what-it-is/detail-light.webp` | **Detalle de un lead.** Análisis de dolores (evidencia, inferencia y especulación) de una asesoría inventada. | **Lead detail.** Pain analysis (evidence, inference, and speculation) for an invented firm. | Panel de un lead ficticio en tema claro, con el bloque de análisis de dolores visible. | Light-theme panel for a fictional lead, with the pain-analysis block visible. |

Pipeline status names stay Spanish in the captions: they are the canonical product values. The i18n slice translates UI labels; it does not rename the enum.

Path: `public/what-it-is/`. Optimized static images (modest weight, modern format). They do not come from Supabase or from an authenticated request.

## 5. Page requirements

- Viewable without signing in, on the same login route.
- Must not slow down the login form: the section does not fetch data or auth; images must not block using the form. Lazy-load them if they sit below the fold.
- Light theme at minimum, with the alt text in the table.
- No visitor cookie, no `DEMO_*`, and no Supabase client to render the section.

## 6. Work in this slice (when implemented)

None of the following is done today.

1. Remove the demo button, the visitor session route and cookie, `DEMO_*` env handling, and the demo tests.
2. Remove `DEMO_SESSION_SECRET` and `DEMO_MODE_ENABLED` from current-behavior docs and from `.env.example`.
3. Add the What it is section and its screenshots.
4. Update login-page E2E (`tests/e2e/visitor-demo.spec.ts` stops describing a visitor session).

## 7. Acceptance criteria

Checkable once an implementation exists. None of them hold today.

1. `src/app/login/page.tsx` shows the section with no session. The default visible title is «Qué es». The English “What it is” copy is in the repository, as is the body in section 3.
2. There is no “Entrar como visitante” button. `POST /api/demo/enter` and `POST /api/demo/exit` are gone. The `gdw_visitor` cookie is not issued. `DemoLeadRepository` is not on the `getSessionLeadRepository()` path.
3. `DEMO_MODE_ENABLED` and `DEMO_SESSION_SECRET` are not read. They are absent from `.env.example` and from the operations guide as live configuration.
4. The four images are in `public/what-it-is/`, static, light theme, fictional data, with the caption and alt text from section 4.
5. With image requests blocked or slow, the login form can still be submitted. The section does not call Supabase.
6. Login E2E covers the section and does not set `DEMO_MODE_ENABLED` or `DEMO_SESSION_SECRET`.

## 8. Out of this slice

- App-wide language switcher, catalogs, and email: [`i18n.md`](./i18n.md).
- Dark-theme screenshots. Light is the minimum; dark can come later.
- The language of AI-generated pain analysis. Still an open question and does not block this section: screenshot 4 uses pre-written fictional analysis, not a model call.
