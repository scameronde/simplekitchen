import { defineConfig } from '@playwright/test';

// Set environment variables for E2E test runs
// This enables test-specific code paths in the application
process.env.E2E_TEST = 'true';
process.env.NODE_ENV = 'test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  workers: 1,
  use: {
    trace: 'on-first-retry',
  },
});
