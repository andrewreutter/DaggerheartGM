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
      // regression suite's per-test default. Dice-tumble holds add a bit more.
      timeout: 240000,
      // One file per subclass — run files across workers when SUBCLASS_PARALLEL is set.
      fullyParallel: true,
      use: {
        headless: !SUBCLASS_HEADED,
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
