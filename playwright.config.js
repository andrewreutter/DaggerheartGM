import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test/browser',
  use: {
    baseURL: 'http://localhost:3457',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'PORT=3457 NODE_ENV=test node --env-file=.env server.js',
    port: 3457,
    reuseExistingServer: false,
    timeout: 30000,
  },
  // Run tests serially within the browser suite to avoid port conflicts.
  workers: 1,
});
