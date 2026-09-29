import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

dotenv.config({ path: path.resolve(ROOT, '.env.local') });
dotenv.config({ path: path.resolve(ROOT, '.env') });

const STORAGE_STATE = path.resolve(ROOT, 'tests/.auth/user.json');

/** Porta effettiva del dev server CBnet (8080 spesso occupata da altri progetti). */
const DEV_PORT = process.env.VITE_DEV_PORT || process.env.E2E_DEV_PORT || '5175';

export default defineConfig({
  testDir: path.resolve(ROOT, 'tests'),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${DEV_PORT}`,
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
      name: 'suite-cbnet',
      dependencies: ['setup'],
      testMatch: [
        '**/e2e/01-auth.spec.ts',
        '**/e2e/02-clienti.spec.ts',
        '**/e2e/03-portafoglio.spec.ts',
        '**/e2e/04-contabilita.spec.ts',
        '**/e2e/05-sinistri.spec.ts',
        '**/e2e/06-navigazione.spec.ts',
        '**/e2e/07-documenti.spec.ts',
      ],
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
    },
    {
      name: 'suite-cbnet-login',
      testMatch: '**/e2e/01-auth.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'bun run dev',
    url: `http://localhost:${DEV_PORT}`,
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
