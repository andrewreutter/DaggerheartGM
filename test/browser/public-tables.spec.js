/**
 * Public tables: spectator watch URLs, homepage Public column, table settings checkbox.
 */
import { test, expect } from '@playwright/test';
import { authenticate } from '../helpers/auth.js';

const PUBLIC_TABLE_ID = 'public-table-id';
const PUBLIC_STATE = {
  items: [{
    id: PUBLIC_TABLE_ID,
    ownerUid: 'other-gm-uid',
    isPublic: true,
    tableName: 'Crossroads Watch',
    elements: [
      { instanceId: 'c1', elementType: 'character', name: 'Briar', tokenX: 10, tokenY: 10, mapId: 'm1' },
    ],
    maps: [{ id: 'm1', name: 'Field', mapSizeFt: 100, mapDimension: 'width' }],
    mapViews: [],
    activeMapId: 'm1',
    fearCount: 0,
    playerEmails: [],
    top: { sessionStarted: true },
  }],
  totalCount: 1,
};

async function mockAnonymousConfig(page) {
  await page.route('/api/config', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ firebaseConfig: {}, imageGenEnabled: false }),
    });
  });
}

test('anonymous visitor can watch a public table and cannot add a character', async ({ page }) => {
  await mockAnonymousConfig(page);
  await page.route(`/api/data/table_state*`, (route) => {
    const url = route.request().url();
    if (url.includes(PUBLIC_TABLE_ID)) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(PUBLIC_STATE) });
    }
    return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Not your table' }) });
  });
  await page.goto(`/table/${PUBLIC_TABLE_ID}`);
  await expect(page.getByText('Briar').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Crossroads Watch')).toBeVisible();
  await expect(page.getByText('Add Character')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Encounter' })).toHaveCount(0);
});

test('anonymous visitor hitting a private table is sent to sign-in', async ({ page }) => {
  await mockAnonymousConfig(page);
  await page.route('/api/data/table_state*', (route) => {
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Not your table' }),
    });
  });
  await page.goto('/table/private-secret-id');
  await expect(page).toHaveURL(/authMode=signin/, { timeout: 10000 });
});

test('anonymous home Public Games shot shows live public table cards', async ({ page }) => {
  await mockAnonymousConfig(page);
  await page.route('/api/public-tables*', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'p1', name: 'Crossroads Watch', gmName: 'Dana', characterNames: ['Briar'], characterCount: 1, previewUrl: null },
        { id: 'p2', name: 'River Watch', gmName: 'Dana', characterNames: ['Thorn'], characterCount: 1, previewUrl: null },
        { id: 'p3', name: 'Hollow Watch', gmName: 'Dana', characterNames: ['Ash'], characterCount: 1, previewUrl: null },
      ]),
    });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Public Games' })).toBeVisible({ timeout: 10000 });
  const shot = page.locator('#home-shot-public-games');
  await expect(shot.getByRole('button', { name: /Crossroads Watch/ })).toBeVisible();
  await expect(shot.getByText('Briar')).toBeVisible();
});

test('home Public column lists public tables and search hits the API', async ({ page }) => {
  await authenticate(page);
  await page.unroute('/api/public-tables*');
  await page.route('/api/public-tables*', (route) => {
    const url = new URL(route.request().url());
    const search = url.searchParams.get('search') || '';
    const rows = search
      ? [{ id: 'p2', name: 'River Watch', gmName: 'Dana', characterNames: ['Thorn'], characterCount: 1, previewUrl: null }]
      : [{ id: 'p1', name: 'Crossroads Watch', gmName: 'Dana', characterNames: ['Briar'], characterCount: 1, previewUrl: null }];
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(rows) });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Public' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Crossroads Watch')).toBeVisible();
  await expect(page.getByText('Briar')).toBeVisible();
  await page.getByLabel('Search public tables').fill('River');
  await expect(page.getByText('River Watch')).toBeVisible({ timeout: 5000 });
});

test('new table settings editor stacks Public table checkbox and Delete under the name', async ({ page }) => {
  await authenticate(page);
  await page.goto('/table/test-user-uid');
  await expect(page.getByPlaceholder('Table name')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('checkbox', { name: /Public table/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Copy Link' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete table' })).toBeVisible();
  const nameBox = page.getByPlaceholder('Table name').boundingBox();
  const publicBox = page.getByRole('checkbox', { name: /Public table/i }).boundingBox();
  const copyBox = page.getByRole('link', { name: 'Copy Link' }).boundingBox();
  const deleteBox = page.getByRole('button', { name: 'Delete table' }).boundingBox();
  const [name, pub, copy, del] = await Promise.all([nameBox, publicBox, copyBox, deleteBox]);
  expect(pub.y).toBeGreaterThan(name.y);
  expect(copy.x).toBeGreaterThan(pub.x);
  expect(del.y).toBeGreaterThan(pub.y);
});
