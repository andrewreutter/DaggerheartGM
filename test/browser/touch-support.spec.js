/**
 * Touch-device support tests.
 *
 * These tests simulate a touch device by overriding `window.matchMedia` so
 * that `(pointer: coarse)` returns `true`. This drives the `useTouchDevice()`
 * hook on the React side, enabling tap-to-toggle behaviour for overlays.
 *
 * We verify:
 *   1. The matchMedia override actually takes effect in the page context.
 *   2. The GM Moves overlay opens on click (tap) instead of requiring hover.
 *   3. The GM Moves overlay closes on a second tap (toggle behaviour).
 */
import { test, expect } from '@playwright/test';
import { authenticate } from '../helpers/auth.js';

// ---------------------------------------------------------------------------
// Override matchMedia so (pointer: coarse) returns true inside the page.
// Must be called before page.goto().
// ---------------------------------------------------------------------------
async function emulateTouch(page) {
  await page.addInitScript(() => {
    const _orig = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      if (query === '(pointer: coarse)') {
        // Return a stable fake MQL that reports coarse pointer and never fires
        // change events, so useTouchDevice() returns true without any re-renders.
        return {
          matches: true,
          media: query,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        };
      }
      return _orig(query);
    };
  });
}

// ---------------------------------------------------------------------------
// Mock the GM SSE stream (`/api/room/my/players`) for the shared fixed test
// uid ('test-user-uid'). No `{ times: 1 }` cap — the browser's EventSource
// auto-reconnects a few seconds after any mocked response body ends (the
// fake stream sent here isn't kept open). If a cap let reconnects fall
// through unmocked, they would hit the real dev server, which can inject
// real leftover DB state for this shared test uid mid-test (see the same
// fix applied in billing-session-gate.spec.js). Always re-fulfilling with
// the same synthetic snapshot keeps every reconnect — and every test's DOM
// state — fully deterministic and isolated from real data.
// ---------------------------------------------------------------------------
async function mockGmStream(page) {
  await page.route(
    '/api/room/my/players*',
    (route) => {
      route.fulfill({
        contentType: 'text/event-stream',
        headers: { 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
        body: `event: presence\ndata: ${JSON.stringify({ players: [] })}\n\n`,
      });
    },
  );
}

// ---------------------------------------------------------------------------
// Test 1: useTouchDevice hook responds to matchMedia override
// ---------------------------------------------------------------------------
test('matchMedia pointer:coarse override takes effect in page', async ({ page }) => {
  await emulateTouch(page);
  await authenticate(page);
  await mockGmStream(page);
  await page.goto('/table/test-user-uid');

  await expect(page.locator('text=Add Character')).toBeVisible({ timeout: 10000 });

  const isCoarse = await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches);
  expect(isCoarse).toBe(true);
});

// ---------------------------------------------------------------------------
// Test 2: GM Moves overlay opens on click in touch mode
// ---------------------------------------------------------------------------
test('GM Moves overlay opens on click (touch tap)', async ({ page }) => {
  await emulateTouch(page);
  await authenticate(page);
  await mockGmStream(page);
  await page.goto('/table/test-user-uid');

  // Wait for the page to fully settle
  await expect(page.locator('text=Add Character')).toBeVisible({ timeout: 10000 });

  // Use data-testid for reliable targeting of the GM Moves trigger
  const trigger = page.getByTestId('gm-moves-trigger');
  await expect(trigger).toBeVisible({ timeout: 5000 });

  // dispatchEvent bypasses Playwright's actionability/stability checks and
  // fires the React onClick directly — needed because background state updates
  // (SSE presence events, table-state loading) can briefly detach elements.
  await trigger.dispatchEvent('click');

  // The GM Moves overlay panel should appear — it has an h2 "GM Moves"
  await expect(page.locator('.fixed h2', { hasText: 'GM Moves' })).toBeVisible({ timeout: 3000 });
});

// ---------------------------------------------------------------------------
// Test 3: GM Moves overlay closes on second tap (toggle)
// ---------------------------------------------------------------------------
test('GM Moves overlay closes on second tap (toggle)', async ({ page }) => {
  await emulateTouch(page);
  await authenticate(page);
  await mockGmStream(page);
  await page.goto('/table/test-user-uid');

  await expect(page.locator('text=Add Character')).toBeVisible({ timeout: 10000 });

  const trigger = page.getByTestId('gm-moves-trigger');
  await expect(trigger).toBeVisible({ timeout: 5000 });

  // First tap — overlay opens (dispatchEvent bypasses actionability checks)
  await trigger.dispatchEvent('click');
  const overlayHeader = page.locator('.fixed h2', { hasText: 'GM Moves' });
  await expect(overlayHeader).toBeVisible({ timeout: 3000 });

  // Second tap — overlay closes (toggle)
  await trigger.dispatchEvent('click');
  await expect(overlayHeader).not.toBeVisible({ timeout: 2000 });
});
