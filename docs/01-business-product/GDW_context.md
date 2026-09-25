# Business And Product Context

## Product

GallaDev Workspace helps advisory and accounting firms discover, qualify, and follow up with prospects. It remains one product and one repository while it evolves from a single-user workspace toward a SaaS product.

## Strategic decision

The SaaS will be built on this project, not on a parallel copy. Git branches and separate Supabase/Vercel environments isolate work and data without duplicating the codebase. The sequence is M1 Secure, minimum SaaS validation, M2 Solid, and M3 Commercial SaaS.

## Pipeline

The canonical pipeline has nine states:

1. `Nuevo`
2. `Pendiente revisar`
3. `Validado`
4. `Email preparado`
5. `Email enviado`
6. `Respondió`
7. `Reunión`
8. `Cliente`
9. `Descartado`

These names are shared by lists, Kanban, filters, KPIs, and Daily Work. New leads enter `Nuevo`, regardless of whether they come from n8n, the public form, or manual entry. `Origen` identifies the source.

## Product rules

- n8n is an optional, replaceable acquisition provider.
- There is no tags field in the product UI.
- A lead has a responsible user (`Lead.responsibleId`, column `responsable`). The drawer assignee dropdown lists the team from `GET /api/team` for an Admin; other writers can assign themselves (**Yo**). The leads list has a **Mis leads** filter on the signed-in user id.
- Favorites persist with the lead.
- Deletion means archiving, not destructive removal.
- Merging fills only empty fields in the surviving lead and archives the other record.
- The user interface remains Spanish.
- AI analysis is stored in `Análisis IA` and distinguishes evidence, inference, and speculation.
- The strategic ICP is 5–30 employees; the current n8n operational filter is 3–10.

## SaaS validation gate

There is no self-signup. An Admin creates each account in the Supabase Dashboard (Authentication → Users); `on_auth_user_created` assigns Seller, and Admin is set on `profiles.role`. A passwordless visitor demo (off by default) can show fictional read-only leads without a Supabase session.

The minimum SaaS milestone is validated when a second user can complete the real workflow `login -> leads -> Kanban -> email -> status change` while row-level access controls prevent cross-user reads and writes. Billing and scale features follow this validation.
