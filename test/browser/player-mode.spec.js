/**
 * Player mode regression tests.
 *
 * Bug fixed: The "Add Character" button silently did nothing when the GM was
 * in "Preview as Player" (impersonation) mode, because `onPlayerAddCharacter`
 * was only passed when `isPlayer` (real player URL) was true, not when
 * `effectiveIsPlayer` (preview mode) was true.
 *
 * These tests cover both the regression and the broader rule:
 *   - Players CAN add characters (assigned to themselves)
 *   - GM CAN add characters while impersonating a player
 *   - Players are BLOCKED from GM-only controls
 */
import { test, expect } from '@playwright/test';
import { authenticate, TEST_USER } from '../helpers/auth.js';

// UID for a "foreign" GM table — different from TEST_USER.uid so isPlayer=true
const OTHER_GM_UID = 'other-gm-uid';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mock the player SSE stream for a given GM UID.
 * Sends an initial `state` event so playerTableState is populated.
 *
 * Uses `{ times: 1 }` so only the FIRST SSE request is mocked. Subsequent
 * reconnects (EventSource auto-reconnects when the stream closes) fall through
 * to the test server, which returns 401 (test-token can't be verified by
 * Firebase admin). This prevents a re-render loop that would prevent Playwright
 * from clicking elements due to constant DOM detachment.
 */
async function mockPlayerStream(page, gmUid, { elements = [] } = {}) {
  const tableState = {
    elements,
    featureCountdowns: {},
    tableBattleMods: {},
    fearCount: 0,
  };
  await page.route(
    `/api/room/${gmUid}/stream*`,
    (route) => {
      route.fulfill({
        contentType: 'text/event-stream',
        headers: { 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
        body: [
          `event: state\ndata: ${JSON.stringify(tableState)}\n\n`,
          `event: presence\ndata: ${JSON.stringify({ players: [] })}\n\n`,
        ].join(''),
      });
    },
    { times: 1 },
  );
}

/**
 * Mock the GM's table state to include a player email so the "Invited Players"
 * panel shows up and the GM can enter preview mode.
 * Call AFTER authenticate() so the LIFO route order makes this take precedence.
 *
 * The item must be FLAT (like the real server returns after spreading r.data),
 * not nested inside a `data` key. app.jsx reads tableState.playerEmails directly.
 */
async function mockTableStateWithPlayer(page, playerEmail) {
  await page.route('/api/data/table_state*', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [{
          id: 'current',
          playerEmails: [playerEmail],
          elements: [],
          fearCount: 0,
          is_public: false,
          _source: 'own',
        }],
        totalCount: 1,
      }),
    });
  });
}

/**
 * Navigate to a page, open the Invited Players panel, and click the Eye icon
 * to enter preview mode for the given email.
 */
async function enterPreviewMode(page, email) {
  await page.click('button[title="Manage invited players"]');
  await expect(page.locator('text=Invited Players')).toBeVisible({ timeout: 3000 });
  await page.click(`button[title="Preview as ${email}"]`);
  await expect(page.locator('text=Previewing as')).toBeVisible({ timeout: 3000 });
}

// ---------------------------------------------------------------------------
// Real player mode: Add Character
// ---------------------------------------------------------------------------

test('player sees the Add Character button on a GM table', async ({ page }) => {
  await authenticate(page);
  await mockPlayerStream(page, OTHER_GM_UID);
  await page.goto(`/gm-table/${OTHER_GM_UID}`);

  await expect(page.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 10000 });
});

test('player clicking Add Character opens the character dialog', async ({ page }) => {
  await authenticate(page);
  await mockPlayerStream(page, OTHER_GM_UID);
  await page.goto(`/gm-table/${OTHER_GM_UID}`);

  const addBtn = page.locator('button', { hasText: 'Add Character' });
  await expect(addBtn).toBeVisible({ timeout: 10000 });
  await addBtn.click();
  await expect(page.locator('input[placeholder="e.g. Thorn"]')).toBeVisible({ timeout: 5000 });
});

test('player Add Character submits and the new character appears (regression)', async ({ page }) => {
  await authenticate(page);
  await mockPlayerStream(page, OTHER_GM_UID);

  // Mock the server-side add-character endpoint
  await page.route(`/api/room/${OTHER_GM_UID}/add-character`, (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        character: {
          instanceId: 'char-player-1',
          elementType: 'character',
          name: 'Aria the Brave',
          tier: 1,
          hope: 6, maxHope: 6, maxHp: 6, maxStress: 6,
          currentHp: 6, currentStress: 0, conditions: '',
          assignedPlayerUid: TEST_USER.uid,
        },
      }),
    });
  });

  await page.goto(`/gm-table/${OTHER_GM_UID}`);
  const addBtn = page.locator('button', { hasText: 'Add Character' });
  await expect(addBtn).toBeVisible({ timeout: 10000 });
  await addBtn.click();
  await page.fill('input[placeholder="e.g. Thorn"]', 'Aria the Brave');
  await page.click('button:has-text("Add to Table")');

  await expect(page.locator('text=Aria the Brave')).toBeVisible({ timeout: 5000 });
});

// ---------------------------------------------------------------------------
// Real player mode: blocked from GM-only controls
// ---------------------------------------------------------------------------

test('player mode: Manage Invited Players button is hidden', async ({ page }) => {
  await authenticate(page);
  await mockPlayerStream(page, OTHER_GM_UID);
  await page.goto(`/gm-table/${OTHER_GM_UID}`);

  await expect(page.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 10000 });

  // This button is GM-only; players must not see it
  await expect(page.locator('[title="Manage invited players"]')).not.toBeVisible();
});

test('player mode: GM Encounter panel Add button is hidden', async ({ page }) => {
  await authenticate(page);
  await mockPlayerStream(page, OTHER_GM_UID);
  await page.goto(`/gm-table/${OTHER_GM_UID}`);

  await expect(page.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 10000 });

  // The GM-only "Add..." button (for adding adversaries/environments/scenes to the table)
  // lives in the Encounter panel which is entirely hidden for players.
  await expect(page.locator('button', { hasText: 'Add...' })).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// GM preview (impersonation) mode: Add Character — this was the reported bug
// ---------------------------------------------------------------------------

test('GM preview mode: Add Character dialog opens (regression bug fix)', async ({ page }) => {
  const PLAYER_EMAIL = 'player@example.com';
  await authenticate(page);
  await mockTableStateWithPlayer(page, PLAYER_EMAIL);
  await page.goto('/gm-table/test-user-uid');

  await expect(page.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 10000 });
  await enterPreviewMode(page, PLAYER_EMAIL);

  // This was the bug: clicking Add Character silently did nothing in preview mode.
  const addBtn = page.locator('button', { hasText: 'Add Character' });
  await expect(addBtn).toBeVisible({ timeout: 5000 });
  await addBtn.click();
  await expect(page.locator('input[placeholder="e.g. Thorn"]')).toBeVisible({ timeout: 5000 });
});

test('GM preview mode: Add Character submits and character appears on the table', async ({ page }) => {
  const PLAYER_EMAIL = 'player@example.com';
  await authenticate(page);
  await mockTableStateWithPlayer(page, PLAYER_EMAIL);
  await page.goto('/gm-table/test-user-uid');

  await expect(page.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 10000 });
  await enterPreviewMode(page, PLAYER_EMAIL);

  const addBtn = page.locator('button', { hasText: 'Add Character' });
  await expect(addBtn).toBeVisible({ timeout: 5000 });
  await addBtn.click();
  await page.fill('input[placeholder="e.g. Thorn"]', 'Brynn Ashwood');
  await page.click('button:has-text("Add to Table")');

  await expect(page.locator('text=Brynn Ashwood')).toBeVisible({ timeout: 5000 });
});
