# GallaDev Workspace Documentation

## Purpose

GallaDev Workspace is a CRM for reviewing, qualifying, and managing leads for advisory and accounting firms. This documentation is maintained in English and Spanish. The English context is `GDW_context.md`; the Spanish context is `GDW_context.es.md`.

## Documentation map

- `00-overview`: purpose, reading order, terminology, and source hierarchy.
- `01-business-product`: business context and product decisions.
- `02-roadmap-delivery`: roadmap, milestones, implementation state, and verification evidence.
- `03-architecture-integrations`: application architecture, persistence, security, and integrations.
- `04-operations-user-guide`: installation, configuration, daily operation, and troubleshooting.
- `05-ux-ai-contracts`: UX specification and the AI pain-analysis contract.
- `06-history-maintenance`: development sessions and historical maintenance notes.
- `diagrams`: generated architecture diagrams and visual-check artifacts.
- `archive`: historical migration script; it is not part of the runtime.

## Recommended reading order

1. Business and product context.
2. Current architecture and integrations.
3. Roadmap and implementation state.
4. Operations and user guide.
5. UX and AI contracts.
6. Historical notes only when investigating a past change.

## Source hierarchy

When documents disagree, use this order:

1. The current code in `src/` and the active Supabase schema.
2. Product decisions in `01-business-product`.
3. Architecture and integration context in `03-architecture-integrations`.
4. The roadmap in `02-roadmap-delivery`.
5. Historical notes in `06-history-maintenance`.

Supabase is the current source of truth for leads. References to Notion describe the historical migration path unless explicitly marked otherwise.

## Current product summary

The application supports lead ingestion, search, filtering, detail editing, Kanban, email review, statistics, duplicate handling, settings, and AI pain analysis. Every new lead enters the `Nuevo` state and carries an `Origen` value. n8n is optional; manual and web ingestion remain valid paths.

The first SaaS validation target is `signup/login -> leads -> Kanban -> email -> status change`, with users unable to read or modify another user's leads.
