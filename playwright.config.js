import { defineConfig } from '@playwright/test';

// Allow parallel subclass-video authoring agents to each run their own isolated
// webServer + DB-identity namespace (see test/helpers/multi-auth.js) without colliding
// on port 3457. Unset PLAYWRIGHT_TEST_PORT preserves the existing single-server behavior.
const PORT = Number(process.env.PLAYWRIGHT_TEST_PORT || 3457);

export default defineConfig({
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `PORT=${PORT} NODE_ENV=test node --env-file=.env server.js`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 30000,
  },
  // Run tests serially within each browser suite to avoid port conflicts.
  workers: 1,
  projects: [
    {
      name: 'default',
      testDir: 'test/browser',
    },
    {
      name: 'subclass-videos',
      testDir: 'test/browser-subclass',
      // Multi-actor walkthroughs with deliberate caption pauses run much longer than the
      // regression suite's per-test default.
      timeout: 180000,
    },
  ],
});
