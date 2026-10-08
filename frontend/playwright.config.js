import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Run tests sequentially to avoid conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to prevent database conflicts
  // In CI, failures are annotated on the run and listed in its log; the HTML
  // report (with traces) is uploaded as an artifact
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  
  use: {
    baseURL: 'https://localhost:8443',
    ignoreHTTPSErrors: true, // Allow self-signed cert
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Runs against the isolated test stack, never .env.prod: E2E used to boot
  // the production compose file with E2E_MODE=true, which meant test runs and
  // real deployments shared a config path.
  webServer: {
    // --build: `up` alone reuses a stale backend image after code changes
    command: 'docker compose --env-file .env.test -f docker-compose.test.yml --profile e2e up --build',
    cwd: '..',
    url: 'https://localhost:8443/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    ignoreHTTPSErrors: true,
  },
})
