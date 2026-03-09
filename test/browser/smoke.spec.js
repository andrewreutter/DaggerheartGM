/**
 * Smoke tests: validate the full browser test pipeline works end-to-end.
 *
 * These tests start the Express server (via Playwright webServer config),
 * mock Firebase auth, and exercise basic page rendering.
 *
 * They serve as scaffolding. Real regression tests are added when bugs are fixed
 * (see .cursor/rules/testing.mdc).
 */
import { test, expect } from '@playwright/test';
import { authenticate } from '../helpers/auth.js';

// ---------------------------------------------------------------------------
// Unauthenticated baseline
// ---------------------------------------------------------------------------
test('sign-in page renders when not authenticated', async ({ page }) => {
  // Mock /api/config but do NOT set up auth mocks — app should show sign-in UI.
  await page.route('/api/config', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ firebaseConfig: {}, imageGenEnabled: false }),
    });
  });

  await page.goto('/');

  // The sign-in page should contain a Google sign-in button.
  await expect(page.locator('text=Sign in')).toBeVisible({ timeout: 10000 });
});

// ---------------------------------------------------------------------------
// Authenticated shell
// ---------------------------------------------------------------------------
test('authenticated user sees the library nav and DAGGEROP heading', async ({ page }) => {
  await authenticate(page);
  // Navigate directly to the library route to avoid the root→library redirect.
  await page.goto('/library/adversaries');

  // The DAGGEROP heading and Library nav button both live inside {user && nav}.
  // They become visible once onAuthStateChanged fires and sets the user.
  // Use h1 selector to avoid matching SVG icon path text.
  await expect(page.locator('h1')).toContainText('DAGGERTOP', { timeout: 10000 });
  await expect(page.locator('button', { hasText: 'Library' })).toBeVisible({ timeout: 5000 });
});

test('authenticated user can navigate to the GM Table', async ({ page }) => {
  await authenticate(page);
  await page.goto('/gm-table/test-user-uid');

  // The GM Table has an "Add Character" button in the characters panel.
  await expect(page.locator('text=Add Character')).toBeVisible({ timeout: 10000 });
});
