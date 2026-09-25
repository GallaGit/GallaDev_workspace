# Test Plan — Leads_CRM (historical)

> **Historical (Notion era, 2026-09-11).** This plan targeted `feat/testing-setup` when Notion was the source of truth. It is not the current test contract. Use [`TESTING.md`](../../TESTING.md) and `.github/workflows/ci.yml`. The MSW examples below still name `api.notion.com`; `tests/mocks/handlers.ts` was not updated in the docs alignment (follow-up).

# Test Plan — Leads_CRM

**Fecha:** 2026-09-11  
**Branch objetivo:** `feat/testing-setup` (desde `master`)  
**Stack:** Vitest + React Testing Library + Playwright + MSW  

---

## 1. Objetivos de Cobertura

| Capa | Objetivo | Justificación |
|------|----------|---------------|
| **Unit (src/lib/)** | **80%** | Funciones puras, 0 deps externas, lógica de negocio crítica |
| **Component (src/components/)** | **40%** | UI logic, interacciones usuario, render condicional |
| **E2E (Critical paths)** | **6 happy paths + 1 edge c/feature** | Flujos reales usuario, integración real Next.js |

---

## 2. Unit Tests — `src/lib/`

### 2.1 `src/lib/leads/detect-duplicates.test.ts` 🔴 Crítico

**Funciones a testear:**
- `normalizeEmail` — alias `+`, case-insensitive, dominios públicos filtrados
- `normalizePhone` — dígitos only, código ES `34`/`0034`, min 7 dígitos
- `normalizeDomain` — hostname sin `www`, filtra webmail/social
- `normalizeCompanyName` — fold accents, drop legal tokens (SL, SA, etc.), generic names
- `normalizeAddressKey` — street + CP/ciudad, min length guards
- `detectDuplicateGroups` — union-find transitivo, 5 razones, incluye archivados, ordenación grupos

**Casos de prueba (≥ 35 tests):**

| Categoría | Casos |
|-----------|-------|
| Email | `test@domain.com`, `TEST@DOMAIN.COM`, `test+alias@domain.com`, `test@GMAIL.COM` (filtrado), inválidos |
| Teléfono | `+34 600 111 222`, `0034600111222`, `600111222`, `911234567`, cortos, con espacios/guiones |
| Dominio | `https://web.com`, `http://www.web.com/path`, `mailto:test@gmail.com` (null), `linkedin.com/in/x` (null) |
| Empresa | `"Asesoría SL"` → `"asesoria"`, `"Gestoría SA"` → `"gestoria"`, `"Mi Empresa S.L."` → `"mi empresa"`, genéricos filtrados |
| Dirección | `"Calle Mayor 12, 46001 Valencia"` → `"mayor 12|46001"`, solo ciudad → null si < 12 chars |
| Grupos | 2 leads mismo email → 1 grupo; transitivo A=B(email), B=C(tel) → 1 grupo ABC; archivados incluidos; orden: size desc, nombre asc |

---

### 2.2 `src/lib/leads/lead-scorer.test.ts` 🔴 Crítico

**Funciones a testear:**
- `scoreLead` — total 0-100, breakdown 7 factores
- `scorers.hasEmail` — cualquier email (general/comercial/gerente)
- `scorers.hasPhone` / `hasWeb` / `hasLinkedIn` — presence
- `scorers.employeeRangeFit` — ICP 5-30 (20pts), near 3-4/31-50 (10pts), else 0
- `scorers.cityKnown` — canonical cities set (22 Valencia area)
- `scorers.statusProgress` — pipeline index / maxIndex × 15, `Descartado` = 0

**Casos de prueba (≥ 25 tests):**

| Categoría | Casos |
|-----------|-------|
| Pesos | Suma pesos = 100; cada factor max = su peso |
| Empleados | `null`→0, `3`→10, `5`→20, `30`→20, `31`→10, `50`→10, `51`→0, `0`→0 |
| Ciudad | `"Valencia"`→10, `"València"`→10 (canonical), `"Madrid"`→0, `null`→0 |
| Pipeline | `Nuevo`→0, `Validado`→~3, `Email preparado`→~6, `Cliente`→15, `Descartado`→0 |
| Combinados | Lead completo ICP → 100; lead mínimo → 0; partials |

---

### 2.3 `src/lib/leads/compute-stats.test.ts` 🔴 Crítico

**Funciones a testear:**
- `computeLeadStats` — total, byStatus, byProvince, byCity, byEmployees, funnel, rates
- `reachedOrBeyond` — cuenta leads en status ≥ target (excluye `Descartado`)
- `toRows` — percent calculation, sortByCount, hideZero
- `EMPLOYEE_BUCKETS` — 6 buckets correctos

**Casos de prueba (≥ 20 tests):**

| Categoría | Casos |
|-----------|-------|
| byStatus | 9 estados, conteos correctos, percent = count/total×100 (1 decimal) |
| byProvince | Orden `PROVINCES` array, "Sin provincia" al final, sort count desc dentro |
| byCity | Top 20, sort count desc, "Sin ciudad" incluido |
| byEmployees | 6 buckets exactos, conteos correctos |
| Funnel rates | `reachedOrBeyond("Validado")` excluye `Descartado`; `% = count/total` |
| Edge | Empty leads → all zeros; solo `Descartado` → rates 0 |

---

### 2.4 `src/lib/leads/merge-leads.test.ts` 🟡 Media

**Funciones a testear:**
- `mergeLeads(keep, archive)` — patch solo campos vacíos de `keep`, `archive` se archiva
- `computeMergePreview` — preview de qué campos se llenarían

**Casos de prueba (≥ 12 tests):**

| Categoría | Casos |
|-----------|-------|
| Merge básico | `keep` sin email, `archive` con email → patch email en keep |
| No sobrescribe | `keep` con teléfono, `archive` con otro → keep intacto |
| Múltiples campos | Varios vacíos en keep, llenos en archive → todos patch |
| Campos null/undefined | Tratados como vacíos |
| Preview | Lista campos que cambiarían con valores origen/destino |

---

### 2.5 `src/lib/leads/filter-leads.test.ts` 🟡 Media

**Funciones a testear:**
- `filterLeads(leads, filters)` — AND combinado, chips activos
- Normalización ciudad en filtro

**Casos de prueba (≥ 15 tests):**

| Categoría | Casos |
|-----------|-------|
| Estado | Array `["Nuevo", "Validado"]` → match cualquiera |
| Provincia/Ciudad | Ciudad normalizada match canonical; provincia exacta |
| Empleados | Rango min/max inclusive |
| Fechas | `discoveredFrom`/`discoveredTo` inclusive |
| Has flags | `hasEmail=true` → al menos uno email; `hasPhone`, `hasWeb`, `hasLinkedIn` |
| Combinado | 3+ filtros AND → intersección |

---

### 2.6 `src/lib/leads/validate-lead.test.ts` 🟡 Media

**Funciones a testear:**
- `validateLeadCreate(input)` — required: `companyName`; email format; phone digits
- `validateLeadPatch(patch)` — partial, mismos validadores

**Casos de prueba (≥ 10 tests):**

| Categoría | Casos |
|-----------|-------|
| Create válido | Empresa + email válido → ok |
| Create inválido | Sin empresa → error; email malformed → error; phone non-digits → error |
| Patch válido | Solo status → ok; solo notas → ok |
| Patch inválido | Email malformed en patch → error |

---

### 2.7 `src/lib/leads/work-queues.test.ts` 🟡 Media

**Funciones a testear:**
- `buildWorkQueues(leads)` — 6 colas, `count`, `firstLeadId`, `id` (WorkQueueId)

**Casos de prueba (≥ 10 tests):**

| Cola | Criterio |
|------|----------|
| `pendiente_revisar` | status `Nuevo` OR `Pendiente revisar` |
| `faltan_datos` | Sin email Y sin teléfono Y sin web |
| `emails_listos` | `Email preparado` OR (borrador en `Nuevo`/`Pendiente revisar`/`Validado`) |
| `followup_overdue` | `nextFollowUp` < today Y status activo |
| `duplicados` | En `getDuplicateLeadIds` |
| `archivados` | `archived: true` |

---

### 2.8 `src/lib/ai/pain-analysis.test.ts` 🔴 Crítico

**Funciones a testear:**
- `parsePainAnalysis(text)` — ES headings, EN headings, JSON, mixed
- `formatPainAnalysis(analysis)` — 3 secciones, bullets, límite 2000 chars
- `normalizePainAnalysis(partial)` — limpia arrays, dedupe case-insensitive
- `hasStructuredPainAnalysis(text)` — true si 3 secciones con contenido
- `fromApiPainAnalysis(value)` — keys ES/EN, arrays → normalized
- `resolvePainAnalysis(api, stored)` — prioriza API, fallback stored
- `hasPainAnalysisSignal(lead)` — website/notes/software/services
- `buildLeadFacts(lead)` — líneas `Label: value`, omite null/empty

**Casos de prueba (≥ 30 tests):**

| Categoría | Casos |
|-----------|-------|
| Parse ES | `Evidencia\n• item1\n\nInferencia\n• item2` → 3 arrays |
| Parse EN | `Evidence\n• item1\n\nInference\n• item2` → 3 arrays |
| Parse JSON | `{"evidencia":["a"],"inferencia":["b"],"especulacion":["c"]}` |
| Parse mixed | Headings con `#`, `**`, bullets `•`, `-`, `*` |
| Format | 3 secciones con items → string formateado; vacío → `• —` |
| Truncate | >2000 chars → recorta + `…` |
| API keys | `evidencia`/`evidence`/`Evidencia` → normalizado |
| Signal | Lead con website → true; lead vacío → false |
| Facts | Todos campos → líneas; solo empresa → 1 línea |

---

### 2.9 `src/lib/geo/cities.test.ts` 🔴 Crítico

**Funciones a testear:**
- `normalizeCity(raw)` — canonical → canonical; alias → canonical; unknown → raw trimmed
- `CANONICAL_CITIES` — 22 entries, includes aliases map

**Casos de prueba (≥ 25 tests):**

| Categoría | Casos |
|-----------|-------|
| Canonical directos | `"Valencia"` → `"Valencia"`, `"Castellón"` → `"Castellón"` |
| Aliases sin acento | `"valencia"` → `"Valencia"`, `"castellon"` → `"Castellón"` |
| Aliases listados | `"València"` → `"Valencia"`, `"Castelló"` → `"Castellón"`, `"Sagunt"` → `"Sagunto"` |
| Case insensitive | `"VALENCIA"`, `"valencia"`, `"VaLeNcIa"` → `"Valencia"` |
| Unknown | `"Madrid"` → `"Madrid"` (trimmed), `""` → `""` |
| Set membership | `CANONICAL_CITIES.has("Valencia")` true, 22 items |

---

### 2.10 `src/lib/utils/email-plain.test.ts` 🟡 Media

**Funciones a testear:**
- `splitNotes(text)` — `observaciones` ≤ 2000, `overflow` resto
- `domainFromUrl(url)` — hostname sin protocolo/www

**Casos de prueba (≥ 8 tests):**

| Categoría | Casos |
|-----------|-------|
| splitNotes | `< 2000` → obs=text, overflow=null; `> 2000` → split en 2000 |
| domainFromUrl | `"https://web.com"` → `"web.com"`, `"http://www.web.com/path"` → `"web.com"`, `"web.com"` → `"web.com"`, `mailto:test@x.com` → `null` |

---

### 2.11 `src/lib/domain/lead.test.ts` 🟡 Media

**Funciones a testear:**
- Type guards: `isLeadStatus`, `isLead`
- `LEAD_STATUSES` array — 9 items, orden canónico

**Casos de prueba (≥ 8 tests):**

| Categoría | Casos |
|-----------|-------|
| Status válidos | 9 strings exactos del pipeline |
| Type guard | `"Nuevo"` → true; `"Invalido"` → false |
| Lead shape | Required fields presentes; opcionales undefined ok |

---

## 3. Component Tests — `src/components/leads/`

### 3.1 `src/components/leads/lead-table.test.tsx`

**Qué testear:**
- Render skeleton rows mientras `isLoading`
- Render data rows con columnas correctas
- Inline status select → llama `onStatusChange(id, newStatus)`
- Row click → llama `onSelect(id)` / abre drawer
- Selection checkbox → `onSelectionChange(ids[])`
- Column picker → muestra/oculta columnas, persiste localStorage
- Empty state → mensaje "Sin leads"
- Error state → muestra error + retry button

**Casos (≥ 12 tests)**

---

### 3.2 `src/components/leads/lead-drawer.test.tsx`

**Qué testear:**
- Abre/cierra con `isOpen` prop
- Tabs: CRM / Notas / Email / Dolores → render condicional
- CRM tab: campos editables, save → `onUpdate(id, patch)`
- Notas tab: textarea, char counter, overflow warning
- Email tab: editor comparte `EmailEditor`, template apply
- Dolores tab: `PainAnalysisSection` render, botón detectar → `onAnalyze(id)`
- Acciones: Favorite toggle, Archive (confirm dialog), External links
- Focus trap al abrir, Escape cierra

**Casos (≥ 15 tests)**

---

### 3.3 `src/components/leads/lead-filters.test.tsx`

**Qué testear:**
- Render chips por categoría (provincia, ciudad, estado, empleados, fechas, has*)
- Click chip → toggle, URL searchParams actualizado
- Provincia change → ciudad options filtradas (cascade)
- Clear all → resetea todo, URL limpia
- Persistencia: recarga mantiene filtros de URL
- Mobile: drawer responsive

**Casos (≥ 10 tests)**

---

### 3.4 `src/components/leads/email-editor.test.tsx`

**Qué testear:**
- Render textarea con valor inicial
- Toolbar: template dropdown, copy, save
- Template apply → confirm si dirty → reemplaza contenido
- Char counter, validation
- Plano: no HTML, `<br>` → `\n`

**Casos (≥ 8 tests)**

---

### 3.5 `src/components/leads/pain-analysis-section.test.tsx`

**Qué testear:**
- Loading state mientras analiza
- Render 3 secciones: Evidencia / Inferencia / Especulación
- Items como bullets, sección vacía → `• —`
- Re-analizar botón → llama `onAnalyze`, muestra loading
- Error state → toast error, no corrompe lead

**Casos (≥ 8 tests)**

---

## 4. E2E Tests — Playwright

**Archivo:** `tests/e2e/critical-paths.spec.ts`

### 4.1 Sync Flow (Happy Path)
```
1. goto /leads
2. wait for skeleton → data loaded
3. verify sync indicator: "Sincronizado hace X min" + badge green
4. verify lead count > 0
```

### 4.2 Lead Detail & Edit
```
1. goto /leads
2. click first row
3. verify drawer opens with lead data
4. change status via inline select → toast "Estado actualizado"
5. edit notas → save → toast "Notas actualizadas"
6. toggle favorite → star filled
7. close drawer → reopen → changes persisted
```

### 4.3 Kanban Drag & Drop
```
1. goto /kanban
2. drag card from "Nuevo" to "Validado"
3. wait for PATCH /api/leads/:id
4. verify toast "Estado actualizado"
5. refresh → card stays in "Validado"
```

### 4.4 Duplicates Merge
```
1. goto /duplicates
2. verify groups listed with reasons
3. click group → compare view
4. click "Fusionar" (keep first, archive second)
5. confirm dialog → POST /api/leads/merge
6. verify group removed from list
7. verify archived lead not in /leads
```

### 4.5 AI Analysis (Detectar Dolores)
```
1. goto /leads
2. open lead with website/notes
2. click "Detectar dolores" in drawer
3. wait for loading → 3 sections render
4. verify sections: Evidencia, Inferencia, Especulación
5. verify Notion `Análisis IA` updated (via API check or UI persist)
```

### 4.6 Settings Connection Tests
```
1. goto /settings
2. click "Probar" Notion → badge "ok" + lastSyncedAt
3. click "Probar" Groq → badge "ok"
4. click "Probar" n8n → badge "ok" (si URL configurada)
5. invalid token → badge "error" + message
```

### 4.7 Edge Cases (1 per feature)
| Feature | Edge Case |
|---------|-----------|
| Sync | Network error → indicator "error" + retry button |
| Lead edit | PATCH 500 → toast error, local state reverted |
| Kanban | Drag to same column → no PATCH |
| Duplicates | Merge with no empty fields → no patch, only archive |
| AI | Groq 502 → toast error, `Análisis IA` unchanged |
| Settings | Save invalid URL → validation error inline |

---

## 5. Test Infrastructure

### 5.1 Vitest Config
```typescript
// vitest.config.ts
- environment: 'jsdom'
- setupFiles: ['vitest.setup.ts']
- include: ['src/**/*.test.{ts,tsx}']
- coverage: v8, thresholds { lines: 80, functions: 80, branches: 70, statements: 80 }
- alias: '@' → './src'
```

### 5.2 MSW Handlers (`tests/mocks/handlers.ts`)
```typescript
// Notion API
- GET /v1/data-sources/:id/query → paginated leads
- PATCH /v1/pages/:id → updated lead
- POST /v1/pages → created lead
- POST /v1/comments → 200 (silent fail allowed)
- POST /v1/blocks/:id/children → activity/append

// Groq API
- POST /chat/completions → pain analysis JSON

// n8n webhook
- POST /webhook/:action → 200
```

### 5.3 Test Data Factories (`tests/factories/lead.ts`)
```typescript
- createLead(overrides?) → Lead completo válido
- createLeadMinimal() → solo required fields
- createLeadsArray(count, overrides?) → array para stats/duplicates
- createDuplicateGroup() → leads con emails/tel/dominios compartidos
```

### 5.4 CI Pipeline (`.github/workflows/test.yml`)
```yaml
jobs:
  unit:
    runs: npm run test:unit -- --coverage
    gates: thresholds per vitest.config
  component:
    runs: npm run test:component
  e2e:
    runs: npm run test:e2e
    needs: [unit, component]  # optional parallel
  lint-typecheck:
    runs: npm run lint && npx tsc --noEmit
```

---

## 6. Comandos NPM a Añadir

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:unit": "vitest run src/lib",
    "test:component": "vitest run src/components",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:ci": "npm run test:unit && npm run test:component && npm run test:e2e"
  }
}
```

---

## 7. Estimación de Esfuerzo

| Fase | Archivos | Tests aprox | Tiempo estimado |
|------|----------|-------------|-----------------|
| Setup (deps, config, MSW, factories) | 6 | - | 2h |
| Unit leads (7 files) | 7 | ~145 | 4h |
| Unit ai/geo/utils/domain | 4 | ~70 | 2h |
| Component tests | 5 | ~53 | 3h |
| E2E critical paths | 1 | 7 + 6 edge | 3h |
| CI + docs | 2 | - | 1h |
| **Total** | **25** | **~275** | **~15h** |

---

## 8. Criterios de Done

- [ ] `npm run test:ci` pasa en local
- [ ] Coverage thresholds cumplidos (lib ≥ 80%)
- [ ] Playwright tests pasan headed + headless
- [ ] CI workflow verde en PR
- [ ] Documentación `TESTING.md` con cómo correr/debuggear tests
- [ ] Badge coverage en README

---

## 9. Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Notion API types cambian | MSW handlers versionados, tests contra contract types |
| Flakiness E2E | Retry 2x, wait-for-network-idle, data-testid en componentes |
| Slow CI | Parallel jobs, cache node_modules, solo E2E en PRs a master |
| Mock drift | Tests de contrato: validar MSW responses contra types reales |

---

## 10. Próximos Pasos (tras aprobación)

1. Crear rama `feat/testing-setup` desde `master`
2. Instalar dependencias
3. Configurar Vitest + MSW + factories
4. Implementar unit tests por prioridad (2.1 → 2.11)
5. Implementar component tests (3.1 → 3.5)
6. Implementar E2E tests (4.1 → 4.7)
7. CI pipeline + thresholds
8. PR a `master` con reporte coverage