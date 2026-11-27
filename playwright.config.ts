import process from 'node:process';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './packages/client/e2e',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {}),
  },
  webServer: {
    command: 'pnpm --filter @poputnogo-vetra/client dev --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});
