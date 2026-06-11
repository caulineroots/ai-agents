import { defineConfig, devices } from '@playwright/test';

// E2E for the orçamento wizard. The flow drives real LLM calls, so timeouts are large.
// The Python extractor service is expected to already be running on :8000 (started
// separately so its logs are visible); Next dev is managed here and reuses it.
export default defineConfig({
  testDir: './e2e',
  timeout: 20 * 60 * 1000,       // 20 min — full LLM pipeline
  expect: { timeout: 60_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3001',
    headless: true,
    actionTimeout: 0,
    navigationTimeout: 120_000,
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- -p 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
