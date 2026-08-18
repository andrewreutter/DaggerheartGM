/**
 * Top nav shows at most 3 recently accessed tables and a More → home link.
 */
import { test, expect } from '@playwright/test';
import { authenticate } from '../helpers/auth.js';

const FOUR_TABLES = [
  { id: 't-alpha', name: 'Alpha Table', updatedAt: 1 },
  { id: 't-bravo', name: 'Bravo Table', updatedAt: 2 },
  { id: 't-charlie', name: 'Charlie Table', updatedAt: 3 },
  { id: 't-delta', name: 'Delta Table', updatedAt: 4 },
];

async function mockFourOwnedTables(page) {
  await authenticate(page);
  await page.unroute('/api/my-tables');
  await page.route('/api/my-tables', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(FOUR_TABLES),
      });
    }
    return route.continue();
  });
}

test('nav shows three most recently updated tables plus More to home', async ({ page }) => {
  await mockFourOwnedTables(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'My Tables' })).toBeVisible({ timeout: 10000 });
  const nav = page.locator('nav');
  await expect(nav.getByRole('link', { name: 'Delta Table' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Charlie Table' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Bravo Table' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Alpha Table' })).toHaveCount(0);
  const more = nav.getByRole('link', { name: 'More' });
  await expect(more).toBeVisible();
  await expect(more).toHaveAttribute('href', '/');
  await more.click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'My Tables' })).toBeVisible();
});
