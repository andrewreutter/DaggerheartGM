/**
 * Battle map "Lock camera" regression tests.
 *
 * Bug: clicking a placed character's tray "ghost" token (the dim proxy shown when a
 * character is already placed on the active map) recentered the map on that token even
 * while the GM had locked the active camera view — defeating the whole point of Lock
 * camera ("prevent accidental pan/zoom"). `centerMapOnPlacedActor` in `BattleMap.jsx` is
 * the single function behind both (a) clicking an on-map tray proxy and (b) the
 * auto-recenter that fires after a shelf click switches the active map — it must
 * early-return while the active `mapViews[]` entry has `locked: true`.
 *
 * The map is sized far larger (1000ft) than the viewport so that `pxPerFt` clamps to
 * `MIN_PX_PER_FT` and the map is guaranteed to need real panning to center the token —
 * this keeps the assertions independent of the exact Playwright viewport size.
 */
import { test, expect } from '@playwright/test';
import { authenticate } from '../helpers/auth.js';

const CHAR_NAME = 'Lockbox Hero';
const MAP_ID = 'map-1';
const VIEW_ID = 'view-1';
const MAP_SIZE_FT = 1000;
const TOKEN_FT = 500;

function buildTableStateSnapshot({ locked }) {
  return {
    elements: [
      {
        instanceId: 'char-1',
        elementType: 'character',
        id: 'lib-char-1',
        name: CHAR_NAME,
        currentHp: 5,
        maxHp: 5,
        currentStress: 0,
        maxStress: 5,
        hope: 2,
        maxHope: 5,
        currentArmor: 0,
        maxArmor: 0,
        conditions: [],
        tokenX: TOKEN_FT,
        tokenY: TOKEN_FT,
        mapId: MAP_ID,
      },
    ],
    featureCountdowns: {},
    sessionCountdowns: [],
    tableBattleMods: {},
    fearCount: 0,
    playerEmails: [],
    tableName: 'Test Table',
    gmDisplayName: 'Test GM',
    top: { sessionStarted: true },
    mapConfig: { mapSizeFt: MAP_SIZE_FT, mapImageUrl: null },
    maps: [{ id: MAP_ID, name: 'Map 1', shareWithPlayers: true }],
    mapViews: [{ id: VIEW_ID, mapId: MAP_ID, name: 'View 1', locked, broadcastToPlayers: true }],
    activeMapId: MAP_ID,
    gmActiveViewId: VIEW_ID,
  };
}

/**
 * Mocks the initial REST snapshot (`loadTableState`) so `tableOwnerUid` resolves to the
 * test uid before SSE connects — required for `shouldPersistMapViewToTable` /
 * `onMapViewSync` (and therefore `canControlMapView`) to be truthy for the GM.
 * Must be called AFTER `authenticate()` so this handler takes LIFO priority over its
 * generic empty `table_state` mock.
 */
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

/**
 * Mocks the GM SSE stream (`/api/room/my/players`) with a fixed `table_state` snapshot.
 * Not capped with `{ times: 1 }` — EventSource auto-reconnects re-hit the same mock with
 * the same synthetic snapshot, keeping the test fully deterministic (see precedent in
 * touch-support.spec.js / billing-session-gate.spec.js).
 */
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

/**
 * The character is placed on the active map, so its name/`title` appears twice: once on the
 * real `PlacedToken` rendered on the map canvas, and once on its dim tray "ghost" proxy (the
 * one clicking should jump to). The proxy is the only one styled `opacity-20` (see
 * `TokenCircle`'s `isProxy && !isOtherMapShelf` class), so scope the locator to that.
 */
function trayProxyLocator(page) {
  return page.locator(`[title="${CHAR_NAME}"].opacity-20`);
}

/** Reads the inline CSS `transform` of the map pan/zoom layer (translate by -pan, then scale). */
async function readMapPanTransform(page) {
  return page
    .locator('.touch-none.bg-dh-canvas > .will-change-transform')
    .first()
    .evaluate((el) => el.style.transform);
}

test('locked camera: clicking a placed character\u2019s tray token does not pan the map', async ({ page }) => {
  const snapshot = buildTableStateSnapshot({ locked: true });
  await authenticate(page);
  await mockTableStateRest(page, snapshot);
  await mockGmStream(page, snapshot);
  await page.goto('/table/test-user-uid');

  await expect(page.locator('text=Add Character')).toBeVisible({ timeout: 10000 });
  const trayToken = trayProxyLocator(page);
  await expect(trayToken).toBeVisible({ timeout: 10000 });

  const before = await readMapPanTransform(page);
  await trayToken.click();

  // Give any (unwanted) pan state update time to flush before asserting it never happened.
  await page.waitForTimeout(500);
  const after = await readMapPanTransform(page);
  expect(after).toBe(before);
});

test('unlocked camera: clicking a placed character\u2019s tray token centers the map on it', async ({ page }) => {
  const snapshot = buildTableStateSnapshot({ locked: false });
  await authenticate(page);
  await mockTableStateRest(page, snapshot);
  await mockGmStream(page, snapshot);
  await page.goto('/table/test-user-uid');

  await expect(page.locator('text=Add Character')).toBeVisible({ timeout: 10000 });
  const trayToken = trayProxyLocator(page);
  await expect(trayToken).toBeVisible({ timeout: 10000 });

  const before = await readMapPanTransform(page);
  await trayToken.click();

  // Sanity check: confirms the click mechanism genuinely recenters the map when unlocked,
  // i.e. the locked-camera test above would fail without the fix.
  await expect.poll(() => readMapPanTransform(page), { timeout: 5000 }).not.toBe(before);
});
