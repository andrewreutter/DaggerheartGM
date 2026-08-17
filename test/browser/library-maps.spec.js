/**
 * Library Maps (first-class collection) — slice 1 + slice 3 UI.
 * Add Map lives on the hovering map-tile overlay (`MapCameraPicker`), not a strip.
 */
import { test, expect } from '@playwright/test';
import { authenticate } from '../helpers/auth.js';

const MAP_ID = 'map-1';
const VIEW_ID = 'view-1';
const LIB_MAP = {
  id: 'lib-map-mine',
  name: 'Mine Crossroads',
  mapImageUrl: 'https://example.test/crossroads.png',
  imageUrl: 'https://example.test/crossroads.png',
  artist: 'Test Artist',
  _source: 'own',
  is_public: false,
};

function tableSnapshot() {
  return {
    elements: [],
    featureCountdowns: {},
    sessionCountdowns: [],
    tableBattleMods: {},
    fearCount: 0,
    playerEmails: [],
    tableName: 'Test Table',
    gmDisplayName: 'Test GM',
    top: { sessionStarted: true },
    mapConfig: { mapSizeFt: 250, mapImageUrl: null },
    maps: [{ id: MAP_ID, name: 'Map 1', shareWithPlayers: true, libraryMapId: 'lib-map-mine' }],
    mapViews: [{ id: VIEW_ID, mapId: MAP_ID, name: 'View 1', locked: false, broadcastToPlayers: true }],
    activeMapId: MAP_ID,
    gmActiveViewId: VIEW_ID,
  };
}

async function mockTableStateRest(page, snapshot) {
  await page.route('/api/data/table_state*', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [{ id: 'test-user-uid', ownerUid: 'test-user-uid', ...snapshot }],
        totalCount: 1,
      }),
    });
  });
}

async function mockGmStream(page, snapshot) {
  await page.route('/api/room/my/players*', (route) => {
    route.fulfill({
      contentType: 'text/event-stream',
      headers: { 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
      body: [
        `event: table_state\ndata: ${JSON.stringify(snapshot)}\n\n`,
        `event: banners\ndata: ${JSON.stringify([])}\n\n`,
        `event: presence\ndata: ${JSON.stringify({ players: [] })}\n\n`,
        `event: roll-history\ndata: ${JSON.stringify({ rolls: [] })}\n\n`,
      ].join(''),
    });
  });
}

async function mockMapsCollection(page, items = [LIB_MAP]) {
  await page.route('**/api/data/maps**', (route) => {
    if (route.request().method() !== 'GET') {
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ item: LIB_MAP }) });
      return;
    }
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items, totalCount: items.length }),
    });
  });
}

test('Library Maps tab: New opens Map editor with Make Public', async ({ page }) => {
  await authenticate(page);
  await mockMapsCollection(page, []);
  await page.route('**/api/data/maps', (route) => {
    if (route.request().method() === 'PUT') {
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'new-map', name: 'Cave' }) });
      return;
    }
    route.continue();
  });
  await page.goto('/library/maps');
  await expect(page.getByRole('button', { name: /New Map/ })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: /New Map/ }).click();
  await expect(page.getByTestId('map-form-name')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('map-form-public')).toBeVisible();
});

test('GM Add Map from map-tile overlay opens picker; Create new map opens editor', async ({ page }) => {
  const snapshot = tableSnapshot();
  await authenticate(page);
  await mockTableStateRest(page, snapshot);
  await mockGmStream(page, snapshot);
  await mockMapsCollection(page, [LIB_MAP]);
  await page.goto('/table/test-user-uid');
  await expect(page.locator('text=Add Character')).toBeVisible({ timeout: 10000 });

  await page.getByTestId('map-camera-picker-trigger').hover();
  await expect(page.getByTestId('map-camera-picker-overlay')).toBeVisible({ timeout: 5000 });
  await page.getByTestId('map-camera-picker-overlay').hover();
  // DOM click: pointer move onto + Add can leave the hover bridge and close the overlay;
  // the overlay also sits under the app nav (z-70).
  await page.getByTestId('map-camera-picker-add-map').evaluate((el) => el.click());
  await expect(page.getByTestId('item-picker-create-map')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Mine Crossroads')).toBeVisible();

  await page.route('**/api/data/maps', (route) => {
    if (route.request().method() === 'PUT') {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ id: 'stub-map', name: '', mapImageUrl: null }),
      });
      return;
    }
    route.continue();
  });
  await page.route('**/api/room/my/op', (route) => {
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.getByTestId('item-picker-create-map').click();
  await expect(page.getByTestId('map-form-name')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('map-form-public')).toBeVisible();
});

test('Scene Make Public is blocked when a referenced map is private', async ({ page }) => {
  const scene = {
    id: 'scene-priv-maps',
    name: 'Blocked Scene',
    maps: [{ id: 'sm1', name: 'Crossroads', libraryMapId: LIB_MAP.id, mapImageUrl: LIB_MAP.mapImageUrl }],
    mapViews: [],
    activeElements: [],
    sessionCountdowns: [],
    tableBattleMods: {},
    partySize: 4,
    partyTier: 1,
    tier: 1,
    bp: 0,
    is_public: false,
    _source: 'own',
  };
  await authenticate(page);
  await page.route('**/api/data/scenes**', (route) => {
    if (route.request().method() === 'PUT') {
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(scene) });
      return;
    }
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items: [scene], totalCount: 1 }),
    });
  });
  await page.route('**/api/data/resolve', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ maps: [LIB_MAP], scenes: [] }),
    });
  });
  await page.goto('/library/scenes/scene-priv-maps');
  await page.getByRole('tab', { name: 'Details' }).click();
  await expect(page.getByTestId('scene-form-public')).toBeVisible({ timeout: 15000 });
  // Gate blocks the check — checkbox stays off and lists the private maps.
  await page.getByTestId('scene-form-public').click();
  await expect(page.getByTestId('scene-public-map-gate')).toBeVisible();
  await expect(page.getByText('Make these maps public too')).toBeVisible();
});
