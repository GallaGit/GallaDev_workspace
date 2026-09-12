# Contrato — Detectar dolores (análisis IA)

**Rama:** `feat/detectar-dolores-ia`  
**Prompt:** `pain-analysis-v1-reconstructed`  
**Regla:** Evidencia solo admite hechos del lead. No inventar webs, cifras ni software.

El corte Grok (`POST /api/leads/pain-analysis`) estaba incompleto en remoto (solo un alias). Se completa aquí y se mantiene `POST /api/leads/:id/analyze` porque el drawer Front ya lo consume.

Ambos usan `analyzeBusinessPains` → `createGroqCompletion` (`src/lib/ai/groq-client.ts`).  
`analyzeBusinessPains` vive en `src/lib/ai/analyze-lead-pains.ts` (server-only).  
`src/lib/ai/pain-analysis.ts` es parse/formato usable en el cliente.

Persistencia: Notion `Análisis IA` (`aiAnalysis`).  
Actividad (timeline): tipo `ai_analyzed` (mismo token en código y PR; no `ai_analysis`).  
Automatización: `dispatchLeadAnalyzed` → webhook `lead_analyzed` (best-effort; no falla el 200).

---

## Front (drawer) — canónico UI

`POST /api/leads/:id/analyze`

Body opcional:

```json
{ "force": false }
```

### 200

```json
{
  "leadId": "notion-page-id",
  "analysis": {
    "evidencia": ["…"],
    "inferencia": ["…"],
    "especulacion": ["…"],
    "summary": "…",
    "model": "openai/gpt-oss-120b",
    "analyzedAt": "2026-09-10T12:00:00.000Z"
  },
  "notionUpdated": true,
  "notified": false,
  "lead": {}
}
```

`force: true` omite el cortocircuito de “sin señales”.  
Sin señal útil: `empty: true`, arrays vacíos, `notionUpdated: false`.

### Errores

| Status | Cuerpo |
|--------|--------|
| 404 | `{ "error": "Lead no encontrado" }` |
| 502 | `{ "error": { "code": "ai_error", "message": "…" } }` — Groq / clave. El lead no se corrompe. |
| 500 | Error al persistir Notion. |

---

## Grok / AI Engineer

`POST /api/leads/pain-analysis`

```json
{ "id": "<leadId>", "lead": {}, "persist": true }
```

- `id` o `lead` (al menos uno).
- `persist` por defecto: `true` si hay `id`, `false` si solo hay `lead`.
- `persist: true` sin `id` → 400.
- `persist: false` analiza y no escribe Notion ni dispara n8n.

### 200

```json
{
  "evidencia": ["…"],
  "inferencia": ["…"],
  "especulacion": ["…"],
  "analysisText": "Evidencia\n• …",
  "model": "openai/gpt-oss-120b",
  "promptVersion": "pain-analysis-v1-reconstructed",
  "persisted": true,
  "lead": {},
  "automation": { "status": "skipped", "reason": "inactive" }
}
```

Mismos 404 / 502 `ai_error` que el endpoint Front.
