# Testing Guide — GallaDev Workspace

## Overview

This project uses a multi-layered testing strategy:

| Layer | Tool | Coverage goal (not enforced) | Location |
|-------|------|-----------------|----------|
| **Unit** | Vitest | 80% lines/functions, 70% branches | `src/lib/**/*.test.ts` |
| **Component** | Vitest + RTL | 40% | `src/components/**/*.test.tsx` |
| **E2E** | Playwright | `critical-paths`, `auth-sync-roles`, `visitor-demo` | `tests/e2e/*.spec.ts` |

---

## Running Tests

### Unit Tests (Pure Functions)

```bash
# Run all unit tests
npm run test:unit

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Component Tests

```bash
npm run test:component
```

### E2E Tests

Playwright starts `npm run start` itself (`playwright.config.ts` `webServer`). Build the production bundle first. Do not rely on `npm run dev` for this suite.

```bash
npm run build
npm run test:e2e

# With UI (still expects the production server on port 3000)
npm run test:e2e:ui
```

Specs in `tests/e2e/`:

- `critical-paths.spec.ts` — unauthenticated redirect, and shell checks that log in when `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` are set.
- `auth-sync-roles.spec.ts` — Admin and Seller (`E2E_ADMIN_*`, `E2E_SELLER_*`). Skipped when those four vars are empty. No Viewer credential.
- `visitor-demo.spec.ts` — passwordless visitor. The Playwright server forces `DEMO_MODE_ENABLED=true` and `DEMO_SESSION_SECRET`.

### Full CI Pipeline

```bash
npm run test:ci
```

---

## Test Structure

```
src/
├── lib/
│   ├── leads/
│   │   ├── detect-duplicates.test.ts    # 35+ tests
│   │   ├── lead-scorer.test.ts          # 25+ tests
│   │   ├── compute-stats.test.ts        # 20+ tests
│   │   ├── merge-leads.test.ts          # 12+ tests
│   │   ├── filter-leads.test.ts         # 15+ tests
│   │   ├── validate-lead.test.ts        # 10+ tests
│   │   └── work-queues.test.ts          # 10+ tests
│   ├── ai/
│   │   └── pain-analysis.test.ts        # 30+ tests
│   ├── geo/
│   │   └── cities.test.ts               # 25+ tests
│   ├── utils/
│   │   └── email-plain.test.ts          # 8+ tests
│   ├── domain/
│   │   └── lead.test.ts                 # 8+ tests
│   ├── auth.test.ts                     # AUTH_DISABLED fail-closed
│   ├── auth/
│   │   └── rbac-routes.test.ts
│   ├── api-auth.test.ts                 # no_profile, roles
│   └── demo/
│       ├── config.test.ts
│       ├── token.test.ts
│       ├── demo-enter.test.ts
│       ├── demo-lead-repository.test.ts
│       ├── visitor-proxy.test.ts
│       ├── visitor-routes.test.ts
│       └── visitor-isolation.test.ts   # getSessionLeadRepository → DemoLeadRepository
├── components/
│   ├── session-access.test.tsx
│   ├── app-error-fallback.test.tsx
│   ├── theme-provider.test.tsx
│   ├── demo/
│   │   └── demo-entry.test.tsx
│   ├── kanban/
│   │   └── kanban-board.test.tsx
│   ├── stats/
│   │   └── status-distribution-chart.test.tsx
│   └── leads/
│       ├── email-editor.test.tsx
│       └── pain-analysis-section.test.tsx
tests/
├── e2e/
│   ├── critical-paths.spec.ts
│   ├── auth-sync-roles.spec.ts
│   └── visitor-demo.spec.ts
├── factories/
│   └── lead.ts                          # Test data factories
└── mocks/
    ├── handlers.ts                      # leftover Notion MSW; not started by vitest.setup.ts
    └── server.ts                        # not imported by the test setup
```

---

## Writing Unit Tests

### Conventions

- **File naming**: `*.test.ts` / `*.test.tsx`
- **Describe blocks**: Group by function/feature
- **Test names**: `it('should do X when Y')`
- **AAA pattern**: Arrange → Act → Assert

### Example

```typescript
import { describe, it, expect } from 'vitest'
import { normalizeEmail } from '@/lib/leads/detect-duplicates'

describe('normalizeEmail', () => {
  it('lowercases email', () => {
    expect(normalizeEmail('TEST@DOMAIN.COM')).toBe('test@domain.com')
  })

  it('removes +alias', () => {
    expect(normalizeEmail('user+tag@domain.com')).toBe('user@domain.com')
  })

  it('returns null for public domains', () => {
    expect(normalizeEmail('test@gmail.com')).toBeNull()
  })
})
```

### Mocking

`vitest.setup.ts` does not start MSW. It stubs browser APIs (`matchMedia`, `localStorage`, `ResizeObserver`). `tests/mocks/handlers.ts` still registers `https://api.notion.com/v1/data-sources/:id/query`, and `tests/mocks/server.ts` is not imported by the setup. That pair is leftover from the Notion runtime. Do not copy it. Route and auth tests mock modules with `vi.mock` (see `src/lib/demo/*.test.ts` and `src/lib/auth/rbac-routes.test.ts`). Retargeting `handlers.ts` is a follow-up; this docs pass does not change that file.

---

## Writing Component Tests

### Conventions

- Use `@testing-library/react` queries (`getByRole`, `getByLabelText`, `getByText`)
- Test user interactions, not implementation details
- Mock callbacks with `vi.fn()`

### Example

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { LeadTable } from '@/components/leads/lead-table'

it('calls onStatusChange when select changes', () => {
  const onStatusChange = vi.fn()
  render(<LeadTable leads={mockLeads} onStatusChange={onStatusChange} />)

  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Validado' } })

  expect(onStatusChange).toHaveBeenCalledWith('lead-1', 'Validado')
})
```

---

## Writing E2E Tests

### Conventions

- Use `data-testid` for reliable selectors
- Test critical user paths
- Include one edge case per feature
- Run against built production bundle

### Example

```typescript
test('Lead Detail: edit status persists', async ({ page }) => {
  await page.goto('/leads')
  await page.locator('tbody tr').first().click()

  await page.getByRole('combobox', { name: /estado/i }).selectOption('Validado')
  await expect(page.getByText('Estado actualizado')).toBeVisible()

  await page.reload()
  await expect(page.locator('tbody tr').first()).toContainText('Validado')
})
```

---

## Debugging Tests

### Unit/Component

```bash
# Run specific test file
npx vitest run src/lib/leads/detect-duplicates.test.ts

# Debug in VS Code
# Add breakpoint, then run "Debug: Vitest" launch config
```

### E2E

```bash
# Headed mode (see browser)
npx playwright test --headed

# Debug specific test
npx playwright test --debug tests/e2e/critical-paths.spec.ts

# Trace viewer
npx playwright show-trace trace.zip
```

---

## Coverage Thresholds

The Vitest config file is `vitest.config.mts` (not `vitest.config.ts`). It sets the v8 provider, reporters, and an `include` list. It does **not** set `coverage.thresholds`, so 80% lines/functions and 70% branches are goals, not a CI failure.

View HTML report after `npm run test:coverage`:

```bash
open coverage/index.html
```

---

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`):

1. **Lint & TypeCheck** - ESLint + TypeScript (Node 22)
2. **Unit Tests** - With coverage upload
3. **Component Tests**
4. **E2E Tests** - `npm run build`, then Playwright (`npm run start`)

There is no Docker Build job. `package.json` has no `docker:*` scripts, and the repo has no Dockerfile or Compose file. The four jobs above are the required checks.

---

## Test Data Factories

Use `tests/factories/lead.ts` for consistent test data:

```typescript
import { createLead, createLeadsArray, createDuplicateGroup } from '@/tests/factories/lead'

const lead = createLead({ status: 'Validado', score: 80 })
const leads = createLeadsArray(10)
const duplicates = createDuplicateGroup({ companyName: 'Test' }, 3)
```

---

## Adding New Tests

1. Identify layer (unit/component/E2E)
2. Create test file next to source (unit/component) or in `tests/e2e/`
3. Follow existing patterns
4. Run locally: `npm run test:unit` / `npm run test:component` / `npm run test:e2e`
5. Ensure CI passes

---

## Common Patterns

### Async/Await in Tests

```typescript
it('handles async operation', async () => {
  const result = await someAsyncFunction()
  expect(result).toBeTruthy()
})
```

### Testing Error Boundaries

```typescript
it('shows error message', () => {
  render(<Component error="Test error" />)
  expect(screen.getByText('Test error')).toBeInTheDocument()
})
```

### Testing Loading States

```typescript
it('shows skeleton while loading', () => {
  render(<Component isLoading />)
  expect(screen.getByTestId('skeleton')).toBeInTheDocument()
})
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ReferenceError: vi is not defined` | Import `vi` from `vitest`. `vitest.config.mts` sets `globals: false`. |
| Playwright timeout | Increase timeout, check `baseURL`, and confirm `npm run build` succeeded. Playwright starts `npm run start`, not the dev server. |
| Coverage below threshold | Add tests for uncovered lines, check `exclude` in config |
| Flaky E2E | Add `waitForLoadState`, use `data-testid`, retry in CI |

---

## Resources

- [Vitest Docs](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright](https://playwright.dev/)
- [MSW](https://mswjs.io/)