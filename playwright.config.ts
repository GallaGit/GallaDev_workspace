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
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      ...process.env,
      // M1: en producción el auth nunca se desactiva; el E2E usa
      // credenciales de prueba y entra por /login (ver critical-paths).
      AUTH_DISABLED: 'false',
      AUTH_SECRET: process.env.E2E_AUTH_SECRET ?? 'e2e-test-secret-local-only',
      AUTH_PASSWORD: process.env.E2E_AUTH_PASSWORD ?? 'e2e-test-password',
      PORT: '3000',
    },
  },
  expect: {
    toHaveScreenshot: { threshold: 0.2 },
  },
})