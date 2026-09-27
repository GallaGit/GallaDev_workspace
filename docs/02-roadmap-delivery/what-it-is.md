# “What it is” Section — Alongside The Visitor Demo

> **Status:** specified, not implemented · decision by Ociel, 26-27 Sep 2026; adjusted 27 Sep 2026 · **Updated:** 2026-09-27
> **Order:** first of the two slices. Language follows: [`i18n.md`](./i18n.md) (ES: [`i18n.es.md`](./i18n.es.md)).
> Do not present this as current behavior. Login is still the form in `src/app/login/page.tsx`. The visitor demo (PR #55) stays as it is: code, `DEMO_*` variables, and the docs that describe how it behaves. Activation in Vercel Production is still pending.

## 1. Decision

The visitor demo stays. The “Entrar como visitante” button, the `gdw_visitor` cookie, `DEMO_MODE_ENABLED`, `DEMO_SESSION_SECRET`, and the read-only session with fictional leads stay as they are.

The same login page **gains** a public **What it is** section (ES: **Qué es**), beside the form on wide screens or below it on narrow ones. It coexists with the button.

- **What it is** explains the tool with text and screenshots. It needs no session.
- **The visitor demo** lets people try the tool read-only with fictional data. It stays off unless `DEMO_MODE_ENABLED` is `true` or `1` and `DEMO_SESSION_SECRET` is set.

## 2. What a signed-out visitor reads

The section is added to the form and the demo button. Email and password remain the CRM door. There is no public signup. When the demo is on, the button stays on the form.

The approved copy is in both languages. Until the i18n slice, the page shows Spanish (the default). English ships in the same change, as this section’s copy, so the later switcher can turn it on without a rewrite. A control that only affects this page is acceptable if it does not compete with the global switcher; if it complicates login, English waits for the i18n slice.

The section is visible when the demo is off: it does not depend on `DEMO_MODE_ENABLED`.

### Spanish — title «Qué es»

GallaDev Workspace es un CRM para revisar, cualificar y gestionar leads de asesorías y gestorías.

Supabase (PostgreSQL) es la fuente de verdad. Los leads entran por la ingesta web o por un alta manual. El equipo los cualifica con un análisis de dolores por IA, los sigue en un Kanban, consulta estadísticas y trabaja con roles: Admin, Seller y Viewer.

Esta explicación se lee sin iniciar sesión. Entrar al CRM sigue pidiendo email y contraseña. No hay alta pública. Con la demo encendida, «Entrar como visitante» abre la misma herramienta en solo lectura, con datos ficticios.

### English — title “What it is”

GallaDev Workspace is a CRM for reviewing, qualifying, and managing leads for asesorías y gestorías (advisory and accounting firms).

Supabase (PostgreSQL) is the source of truth. Leads come in through web ingest or manual entry. The team qualifies them with AI pain analysis, follows them on a Kanban board, reviews statistics, and works with roles: Admin, Seller, and Viewer.

This explanation can be read without signing in. CRM access still asks for email and password. There is no public signup. When the visitor demo is on, “Entrar como visitante” opens the same tool read-only, with fictional data.

## 3. Screenshots

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

## 4. Page requirements

- Viewable without signing in, on the same login route, whether the demo is off or on.
- Must not slow down the login form: the section does not fetch data or auth; images must not block using the form. Lazy-load them if they sit below the fold.
- Light theme at minimum, with the alt text in the table.
- Does not use the visitor cookie or a Supabase client to render. It does not change `DEMO_MODE_ENABLED` or `DEMO_SESSION_SECRET`.

## 5. Work in this slice (when implemented)

The section is not in the app today. The demo is, and this slice does not change it.

1. Add the What it is section and its screenshots on the login page, next to the form.
2. Leave the “Entrar como visitante” button, the route, the cookie, `DEMO_*` handling, `.env.example`, and the demo tests as they are.
3. Extend login E2E for the section. `tests/e2e/visitor-demo.spec.ts` still covers the demo.

## 6. Acceptance criteria

Checkable once an implementation exists. The section does not meet them today; the demo is still in the code.

1. `src/app/login/page.tsx` shows the section with no session, including when `DEMO_MODE_ENABLED` is off. The default visible title is «Qué es». The English “What it is” copy is in the repository, as is the body in section 2.
2. When the demo is on, the same page shows the section and the “Entrar como visitante” button. `POST /api/demo/enter`, `POST /api/demo/exit`, the `gdw_visitor` cookie, and `DemoLeadRepository` stay in place.
3. `DEMO_MODE_ENABLED` and `DEMO_SESSION_SECRET` are read as they are today and remain in `.env.example` and in the operations guide.
4. The four images are in `public/what-it-is/`, static, light theme, fictional data, with the caption and alt text from section 3.
5. With image requests blocked or slow, the login form can still be submitted. The section does not call Supabase.
6. Login E2E covers the section. Demo E2E still sets `DEMO_MODE_ENABLED` and `DEMO_SESSION_SECRET`.

## 7. Out of this slice

- The visitor demo, its button, the `DEMO_*` variables, and their tests. They stay as they are.
- Turning the demo on in Vercel Production. Still pending, and it is configuration, not this slice.
- App-wide language switcher, catalogs, and email: [`i18n.md`](./i18n.md).
- Dark-theme screenshots. Light is the minimum; dark can come later.
- The language of AI-generated pain analysis. Still an open question and does not block this section: screenshot 4 uses pre-written fictional analysis, not a model call.
