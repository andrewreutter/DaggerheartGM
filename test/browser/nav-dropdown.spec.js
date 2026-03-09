/**
 * Regression test: user menu dropdown must not be obscured by the Encounters panel.
 *
 * Bug: nav had z-10 while GMTableView fixed overlays had z-[55..60], causing
 * the dropdown to render behind the encounters panel on the GM Table page.
 * Fix: nav z-index raised to z-[70].
 */
import { test, expect } from '@playwright/test';
import { authenticate } from '../helpers/auth.js';

test('nav z-index is higher than encounter panel overlays so the user menu is never obscured', async ({ page }) => {
  await authenticate(page);
  // Navigate to the library — the nav (and its z-index) is present on all authenticated pages.
  await page.goto('/library/adversaries');

  // Wait for the authenticated shell to render.
  await expect(page.locator('h1')).toContainText('DAGGERTOP', { timeout: 10000 });

  // The nav element must have a z-index that beats the highest encounter-panel
  // fixed overlay (z-index 60). We assert >= 70, the value set in the bugfix.
  const navZIndex = await page.evaluate(() => {
    const nav = document.querySelector('nav');
    if (!nav) return null;
    return parseInt(window.getComputedStyle(nav).zIndex, 10) || 0;
  });

  expect(navZIndex).toBeGreaterThanOrEqual(70);
});
