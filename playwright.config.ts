import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      ...process.env,
      // Paso 2: en producción el auth nunca se desactiva; el E2E entra
      // por /login con el usuario de prueba de Supabase (ver critical-paths).
      // SUPABASE_* son claves públicas (ver .env.example).
      AUTH_DISABLED: 'false',
      SUPABASE_URL:
        process.env.SUPABASE_URL ?? 'https://rafgpbiiwofrqmfpqrij.supabase.co',
      SUPABASE_PUBLISHABLE_KEY:
        process.env.SUPABASE_PUBLISHABLE_KEY ??
        'sb_publishable_0y6b9TMvbTpD96Eo2O1iEQ_DNIv9DV9',
      // Crear usuarios E2E en Supabase Dashboard → Authentication → Users.
      // Ejemplo: E2E_ADMIN_EMAIL=admin@example.com E2E_ADMIN_PASSWORD=...
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