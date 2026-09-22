import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // En CI usamos Chromium de Playwright. En local se puede reutilizar
      // Google Chrome del sistema si está instalado.
      use: {
        ...devices['Desktop Chrome'],
        ...(isCI ? {} : { channel: 'chrome' as const }),
      },
    },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !isCI,
    timeout: 120000,
    env: {
      ...process.env,
      // Paso 2: el auth nunca se desactiva en CI; el E2E entra por /login.
      AUTH_DISABLED: 'false',
      SUPABASE_URL:
        process.env.SUPABASE_URL ?? 'https://rafgpbiiwofrqmfpqrij.supabase.co',
      SUPABASE_PUBLISHABLE_KEY:
        process.env.SUPABASE_PUBLISHABLE_KEY ??
        'sb_publishable_0y6b9TMvbTpD96Eo2O1iEQ_DNIv9DV9',
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ??
        process.env.SUPABASE_URL ??
        'https://rafgpbiiwofrqmfpqrij.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        process.env.SUPABASE_PUBLISHABLE_KEY ??
        'sb_publishable_0y6b9TMvbTpD96Eo2O1iEQ_DNIv9DV9',
      E2E_TEST_EMAIL: process.env.E2E_TEST_EMAIL ?? '',
      E2E_TEST_PASSWORD: process.env.E2E_TEST_PASSWORD ?? '',
      E2E_ADMIN_EMAIL: process.env.E2E_ADMIN_EMAIL ?? '',
      E2E_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD ?? '',
      E2E_SELLER_EMAIL: process.env.E2E_SELLER_EMAIL ?? '',
      E2E_SELLER_PASSWORD: process.env.E2E_SELLER_PASSWORD ?? '',
      PORT: '3000',
    },
  },
  expect: {
    toHaveScreenshot: { threshold: 0.2 },
  },
})
