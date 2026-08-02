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
 *
 * Also mocks the table_state HTTP endpoint so that ownerUid is set to gmUid,
 * which causes app.jsx to derive isPlayer=true (tableOwnerUid != user.uid).
 *
 * No `{ times: 1 }` cap — the browser's EventSource auto-reconnects a few
 * seconds after any mocked response body ends (the fake stream sent here
 * isn't kept open). A cap would let reconnects fall through unmocked to the
 * real dev server, which can return unrelated/real DB state (or a 403/404
 * that Playwright's error banner briefly renders) mid-test. Always
 * re-fulfilling with the same synthetic snapshot keeps every reconnect, and
 * every test's DOM state, fully deterministic (mirrors the fix applied to
 * billing-session-gate.spec.js's mockGmStream).
 */
async function mockPlayerStream(page, gmUid, { elements = [] } = {}) {
  // Override the table_state mock to include ownerUid so isPlayer=true.
  // This must be added AFTER authenticate() so LIFO route ordering makes it win.
  await page.route('/api/data/table_state*', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [{
          id: gmUid,
          ownerUid: gmUid,
          playerEmails: [],
          elements,
          fearCount: 0,
          _source: 'own',
        }],
        totalCount: 1,
      }),
    });
  });

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
          `event: table_state\ndata: ${JSON.stringify({ ...tableState, ownerUid: gmUid, playerEmails: [] })}\n\n`,
          `event: banners\ndata: []\n\n`,
          `event: presence\ndata: ${JSON.stringify({ players: [] })}\n\n`,
        ].join(''),
      });
    },
  );
}

/**
 * Mock the GM's table state to include a player email so the "Invited Players"
 * panel shows up and the GM can enter preview mode.
 * Call AFTER authenticate() so the LIFO route order makes this take precedence.
 *
 * Also mocks the GM SSE endpoint so the real server never overrides playerEmails
 * back to [] via SSE. Without this mock, the server pushes a table_state event
 * from the DB (which has playerEmails: []) and app.jsx resets playerEmails.
 * No { times } limit so all SSE reconnects are intercepted and state stays stable.
 */
async function mockTableStateWithPlayer(page, playerEmail) {
  const tableStateData = {
    id: TEST_USER.uid,
    ownerUid: TEST_USER.uid,
    playerEmails: [playerEmail],
    elements: [],
    fearCount: 0,
    featureCountdowns: {},
    tableBattleMods: {},
    is_public: false,
    _source: 'own',
  };

  await page.route('/api/data/table_state*', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items: [tableStateData], totalCount: 1 }),
    });
  });

  // Mock GM SSE to send the correct playerEmails on every reconnect.
  // Without a times limit, the mock handles all reconnects so the real server
  // never pushes a conflicting table_state event.
  await page.route('/api/room/my/players*', (route) => {
    route.fulfill({
      contentType: 'text/event-stream',
      headers: { 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
      body: [
        `event: table_state\ndata: ${JSON.stringify(tableStateData)}\n\n`,
        `event: banners\ndata: []\n\n`,
        `event: presence\ndata: ${JSON.stringify({ players: [] })}\n\n`,
      ].join(''),
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
  await page.goto(`/table/${OTHER_GM_UID}`);

  await expect(page.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 10000 });
});

test('player clicking Add Character opens the character dialog', async ({ page }) => {
  await authenticate(page);
  await mockPlayerStream(page, OTHER_GM_UID);
  await page.goto(`/table/${OTHER_GM_UID}`);

  const addBtn = page.locator('button', { hasText: 'Add Character' });
  await expect(addBtn).toBeVisible({ timeout: 10000 });
  await addBtn.click();
  // The character picker modal opens with a search input.
  await expect(page.locator('input[placeholder="Search by name..."]')).toBeVisible({ timeout: 5000 });
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

  // Mock the characters collection so the picker shows "Aria the Brave"
  await page.route('/api/data/characters*', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [{
          id: 'test-char-1',
          name: 'Aria the Brave',
          tier: 1, level: 1,
          hope: 6, maxHope: 6, maxHp: 6, maxStress: 6,
          _source: 'own',
        }],
        totalCount: 1,
      }),
    });
  });

  await page.goto(`/table/${OTHER_GM_UID}`);
  const addBtn = page.locator('button', { hasText: 'Add Character' });
  await expect(addBtn).toBeVisible({ timeout: 10000 });
  await addBtn.click();

  // The picker opens. Select "Aria the Brave" from the list.
  // The picker calls onPlayerAddCharacter → postAddCharacter → our mock.
  // GMTableView then calls characterOverlay.show with the returned character,
  // making "Aria the Brave" visible in the hover card overlay.
  await expect(page.locator('input[placeholder="Search by name..."]')).toBeVisible({ timeout: 5000 });

  // The character list uses plain <button> elements — no data-testid on the container.
  // Wait for "Aria the Brave" to appear in the picker (characters load asynchronously).
  const charBtn = page.locator('button', { hasText: 'Aria the Brave' });
  await expect(charBtn).toBeVisible({ timeout: 5000 });

  // Set up request interceptor before clicking to verify the server call is made.
  // (Player mode: state updates arrive via SSE, not immediate local mutation.)
  const addCharRequest = page.waitForRequest(req =>
    req.url().includes('/add-character') && req.method() === 'POST');
  await charBtn.click();

  // Picker closes after selection.
  await expect(page.locator('input[placeholder="Search by name..."]')).not.toBeVisible({ timeout: 5000 });
  // Server endpoint was called.
  await addCharRequest;
});

// ---------------------------------------------------------------------------
// Real player mode: blocked from GM-only controls
// ---------------------------------------------------------------------------

test('player mode: Manage Invited Players button is hidden', async ({ page }) => {
  await authenticate(page);
  await mockPlayerStream(page, OTHER_GM_UID);
  await page.goto(`/table/${OTHER_GM_UID}`);

  await expect(page.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 10000 });

  // This button is GM-only; players must not see it
  await expect(page.locator('[title="Manage invited players"]')).not.toBeVisible();
});

test('player mode: GM Encounter panel Add button is hidden', async ({ page }) => {
  await authenticate(page);
  await mockPlayerStream(page, OTHER_GM_UID);
  await page.goto(`/table/${OTHER_GM_UID}`);

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
  await page.goto('/table/test-user-uid');

  await expect(page.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 10000 });
  await enterPreviewMode(page, PLAYER_EMAIL);

  // This was the bug: clicking Add Character silently did nothing in preview mode.
  const addBtn = page.locator('button', { hasText: 'Add Character' });
  await expect(addBtn).toBeVisible({ timeout: 5000 });
  await addBtn.click();
  // The character picker modal opens with a search input.
  await expect(page.locator('input[placeholder="Search by name..."]')).toBeVisible({ timeout: 5000 });
});

test('GM preview mode: Add Character submits and character appears on the table', async ({ page }) => {
  const PLAYER_EMAIL = 'player@example.com';
  await authenticate(page);
  await mockTableStateWithPlayer(page, PLAYER_EMAIL);

  // Mock the characters collection so the picker shows "Brynn Ashwood"
  await page.route('/api/data/characters*', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [{
          id: 'test-char-2',
          name: 'Brynn Ashwood',
          tier: 1, level: 1,
          hope: 6, maxHope: 6, maxHp: 6, maxStress: 6,
          _source: 'own',
        }],
        totalCount: 1,
      }),
    });
  });

  // Mock table op endpoint so postTableOp doesn't try to hit a real DB table
  await page.route('/api/room/my/op', (route) => {
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.goto('/table/test-user-uid');
  await expect(page.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 10000 });
  await enterPreviewMode(page, PLAYER_EMAIL);

  const addBtn = page.locator('button', { hasText: 'Add Character' });
  await expect(addBtn).toBeVisible({ timeout: 5000 });
  await addBtn.click();

  // The character picker opens. Select "Brynn Ashwood".
  // In GM preview mode (isPlayer=false), GMTableView uses handleGmImpersonateAddCharacter
  // which calls sendAddToTable → doAddToTable → setActiveElements (immediate local update).
  await expect(page.locator('input[placeholder="Search by name..."]')).toBeVisible({ timeout: 5000 });

  // The character list uses plain <button> elements — no data-testid on the container.
  const charBtn = page.locator('button', { hasText: 'Brynn Ashwood' });
  await expect(charBtn).toBeVisible({ timeout: 5000 });
  await charBtn.click();

  // After selection, the picker closes and the character appears in the Characters panel
  // (doAddToTable calls setActiveElements immediately — no SSE needed).
  // Use .first() because the name may appear in both the character card and hover card.
  await expect(page.locator('text=Brynn Ashwood').first()).toBeVisible({ timeout: 5000 });
});
