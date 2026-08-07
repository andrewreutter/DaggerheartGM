import { defineConfig } from '@playwright/test';

// Allow parallel subclass-video authoring agents to each run their own isolated
// webServer + DB-identity namespace (see test/helpers/multi-auth.js) without colliding
// on port 3457. Unset PLAYWRIGHT_TEST_PORT preserves the existing single-server behavior.
const PORT = Number(process.env.PLAYWRIGHT_TEST_PORT || 3457);

// `npm run test:subclasses` sets SUBCLASS_PARALLEL=1 so three video walkthroughs share
// one webServer with per-worker GM/player uids (TEST_PARALLEL_INDEX → actor NS).
// Override count with SUBCLASS_WORKERS=N. Default browser suite stays serial (workers: 1).
const SUBCLASS_PARALLEL = process.env.SUBCLASS_PARALLEL === '1';
const SUBCLASS_WORKERS = Math.max(1, Number(process.env.SUBCLASS_WORKERS || 3) || 3);

// Subclass videos need a real GPU path so the WebGL dice canvas appears in screencasts.
// Default headed; set SUBCLASS_HEADED=0 to force headless (dice may be blank).
const SUBCLASS_HEADED = process.env.SUBCLASS_HEADED !== '0';

export default defineConfig({
  // Purge leftover multi-actor / subclass `table_state` rows for test GM uids
  // before webServer starts (DB-only; see test/playwright-global-setup.js).
  globalSetup: './test/playwright-global-setup.js',
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
  workers: SUBCLASS_PARALLEL ? SUBCLASS_WORKERS : 1,
  projects: [
    {
      name: 'default',
      testDir: 'test/browser',
    },
    {
      name: 'subclass-videos',
      testDir: 'test/browser-subclass',
      // Multi-actor walkthroughs with deliberate caption pauses run much longer than the
      // regression suite's per-test default. Headed + parallel GPU contention needs more
      // headroom than a single headless authoring run.
      timeout: SUBCLASS_HEADED && SUBCLASS_PARALLEL ? 480000 : 300000,
      // One file per subclass — run files across workers when SUBCLASS_PARALLEL is set.
      fullyParallel: true,
      use: {
        headless: !SUBCLASS_HEADED,
        // Fail stuck clicks/expects in ~20s instead of burning the whole test timeout
        // when a banner overlay / wedged WebGL canvas blocks actionability.
        actionTimeout: 20000,
        launchOptions: {
          args: [
            '--enable-webgl',
            '--ignore-gpu-blocklist',
            // Prefer a real ANGLE backend so Three.js dice render into the screencast.
            process.platform === 'darwin' ? '--use-angle=metal' : '--use-angle=gl',
          ],
        },
      },
    },
  ],
});
