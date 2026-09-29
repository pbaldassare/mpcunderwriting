import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_STATE = path.resolve(__dirname, 'tests/.auth/user.json');

/**
 * Vedere https://playwright.dev/docs/test-configuration.
 */
/** Cartelle legacy migrate — i test canonici sono nelle sottocartelle numerate. */
const E2E_LEGACY_IGNORE = [
  '**/e2e/contabilita/**',
  '**/e2e/01-login.spec.ts',
];

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: process.env.VITE_DEV_PORT ? `http://localhost:${process.env.VITE_DEV_PORT}` : 'http://localhost:5175',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'setup',
      testMatch: '**/e2e/00-auth.setup.ts',
    },
    {
      name: 'e2e',
      dependencies: ['setup'],
      testMatch: '**/e2e/**/*.spec.ts',
      testIgnore: E2E_LEGACY_IGNORE,
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
    },
    {
      name: 'login',
      testMatch: '**/e2e/01-login.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      testMatch: '**/*.spec.ts',
      testIgnore: '**/e2e/**',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'bun run dev',
    url: process.env.VITE_DEV_PORT ? `http://localhost:${process.env.VITE_DEV_PORT}` : 'http://localhost:5175',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
