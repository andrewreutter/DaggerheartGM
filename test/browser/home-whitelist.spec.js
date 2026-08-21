/**
 * When GET /api/config reports daggerheartWhitelistDisabled, the anonymous
 * homepage drops marketing copy and Daggerheart mentions, and new signups
 * are closed.
 */
import { test, expect } from '@playwright/test';
import { mockAnonymousFirebase } from '../helpers/auth.js';

async function mockWhitelistDisabledConfig(page) {
  await page.route('/api/config', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        firebaseConfig: {},
        imageGenEnabled: false,
        daggerheartWhitelistDisabled: true,
      }),
    });
  });
}

test('anonymous homepage omits marketing and Daggerheart when whitelist is disabled', async ({ page }) => {
  await mockWhitelistDisabledConfig(page);

  await page.goto('/');

  await expect(page.locator('h1', { hasText: 'Daggertop' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('home-marketing')).toHaveCount(0);
  await expect(page.getByTestId('home-feature-carousel')).toHaveCount(0);
  await expect(page.getByText(/Daggerheart/i)).toHaveCount(0);

  const footerNav = page.locator('footer nav');
  await expect(footerNav).toBeVisible();
  await expect(footerNav.getByRole('link', { name: 'Terms' })).toBeVisible();
});

test('sign-up page is closed when whitelist is disabled', async ({ page }) => {
  await mockAnonymousFirebase(page);
  await mockWhitelistDisabledConfig(page);

  await page.goto('/?authMode=signup');

  await expect(page.getByTestId('new-signups-closed')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('new-signups-closed')).toContainText("Sorry, we're not accepting new users right now.");
  await expect(page.getByRole('button', { name: 'Create account' })).toHaveCount(0);
  await expect(page.getByLabel('Sign in with Google')).toHaveCount(0);
});

test('sign-in page hides create-account when whitelist is disabled', async ({ page }) => {
  await mockAnonymousFirebase(page);
  await mockWhitelistDisabledConfig(page);

  await page.goto('/');

  await expect(page.locator('form button[type="submit"]')).toHaveText('Sign in');
  await expect(page.getByTestId('auth-create-account')).toHaveCount(0);
  await expect(page.getByText('Create an account')).toHaveCount(0);
  await expect(page.getByLabel('Sign in with Google')).toBeVisible();
});
