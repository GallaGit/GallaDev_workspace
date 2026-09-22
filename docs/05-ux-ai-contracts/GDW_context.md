# UX And AI Contracts

## Pain analysis goal

The `Detectar dolores` action analyzes a lead using Groq and stores the result in `Análisis IA`. The feature is best-effort from an automation perspective: a webhook failure must not change the persistence result.

## UI states

The drawer must communicate idle, loading, empty, success, and error states. The action remains available after a previous result so the user can rerun it. The result is displayed below CRM information and above notes.

## Analysis contract

The response is organized into:

- **Evidence:** facts present in the lead data.
- **Inference:** reasonable conclusions derived from those facts.
- **Speculation:** hypotheses that require validation.

The model must not invent websites, figures, software, customer information, or other facts. A Groq error must not modify the lead. Existing analysis is overwritten only after a successful new analysis.

## Endpoints and persistence

- `POST /api/leads/:id/analyze` is the canonical endpoint.
- The legacy pain-analysis alias may remain only where already supported by the application.
- The result is persisted in `Análisis IA`.
- Optional `lead_analyzed` automation is notified asynchronously.
