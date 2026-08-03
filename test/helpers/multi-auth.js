/**
 * Multi-actor Playwright authentication helper (T12).
 *
 * Unlike test/helpers/auth.js (which mocks the entire API surface),
 * this helper authenticates MULTIPLE DISTINCT IDENTITIES against the
 * REAL Express server so multi-context tests can exercise actual SSE
 * propagation, real DB writes, and real game-state mutations.
 *
 * Key design decisions:
 * - Only Firebase CDN JS and /api/config are mocked (so the browser
 *   thinks it is signed-in without a real Firebase project).
 * - All other API routes hit the real server on port 3457 (NODE_ENV=test).
 * - The server's requireAuth accepts "Bearer test-token:<uid>:<email>"
 *   as a test-bypass (T12 extension, active only under NODE_ENV=test).
 * - The legacy bare "test-token" still works for existing single-actor tests.
 *
 * Usage:
 *   import { ACTOR_GM, ACTOR_PLAYER_A, authenticateActor } from '../helpers/multi-auth.js';
 *
 *   test('multi-actor', async ({ browser }) => {
 *     const gmCtx = await browser.newContext();
 *     const playerCtx = await browser.newContext();
 *     const gmPage = await gmCtx.newPage();
 *     const playerPage = await playerCtx.newPage();
 *
 *     await authenticateActor(gmPage, ACTOR_GM);
 *     await authenticateActor(playerPage, ACTOR_PLAYER_A);
 *
 *     await gmPage.goto(`/table/${TABLE_ID}`);
 *     await playerPage.goto(`/table/${TABLE_ID}`);
 *     // ...assertions...
 *   });
 */

export const BASE_URL = 'http://localhost:3457';

/** The legacy GM identity — backward-compat with single-actor tests. */
export const ACTOR_GM = {
  uid: 'test-user-uid',
  email: 'test@example.com',
  displayName: 'Test GM',
  token: 'test-token',
};

/** First multi-actor player identity. */
export const ACTOR_PLAYER_A = {
  uid: 'test-player-a-uid',
  email: 'player-a@example.com',
  displayName: 'Player A',
  token: 'test-token:test-player-a-uid:player-a@example.com',
};

/** Second multi-actor player identity. */
export const ACTOR_PLAYER_B = {
  uid: 'test-player-b-uid',
  email: 'player-b@example.com',
  displayName: 'Player B',
  token: 'test-token:test-player-b-uid:player-b@example.com',
};

// ---------------------------------------------------------------------------
// Firebase client-side mocks (ESM, inlined as strings)
// ---------------------------------------------------------------------------

const MOCK_FIREBASE_APP_JS = `
export function initializeApp() { return {}; }
export function getApp() { return {}; }
export function getApps() { return [{}]; }
`;

/**
 * Build a Firebase auth mock for a specific actor.
 * The actor's token is what the browser sends as the Bearer token on API calls.
 */
function buildFirebaseAuthMock(actor) {
  return `
const mockUser = {
  uid: ${JSON.stringify(actor.uid)},
  email: ${JSON.stringify(actor.email)},
  displayName: ${JSON.stringify(actor.displayName)},
  getIdToken: async () => ${JSON.stringify(actor.token)},
};
const mockAuth = { currentUser: mockUser };
export function getAuth() { return mockAuth; }
export function onAuthStateChanged(_auth, callback) {
  setTimeout(() => callback(mockUser), 0);
  return () => {};
}
export class GoogleAuthProvider {}
GoogleAuthProvider.credentialFromError = function () { return null; };
GoogleAuthProvider.credentialFromResult = function () { return { accessToken: null }; };
export async function signInWithPopup() { return { user: mockUser }; }
export async function linkWithPopup() { return { user: mockUser }; }
export async function reauthenticateWithPopup() { return { user: mockUser }; }
export async function createUserWithEmailAndPassword() { return { user: mockUser }; }
export async function signInWithEmailAndPassword() { return { user: mockUser }; }
export async function sendPasswordResetEmail() {}
export async function fetchSignInMethodsForEmail() { return []; }
export async function linkWithCredential() { return { user: mockUser }; }
export async function updateProfile() {}
export async function signOut() {}
`;
}

// ---------------------------------------------------------------------------
// Core helper
// ---------------------------------------------------------------------------

/**
 * Wire a Playwright page to authenticate as `actor` against the real server.
 *
 * Mocks only:
 *   - Firebase CDN JS (app + auth) — makes the browser think it is signed in
 *   - /api/config — avoids needing real Firebase credentials
 *
 * Everything else (table state, rooms, rolls, SSE) hits the REAL server.
 * Must be called before page.goto().
 */
export async function authenticateActor(page, actor) {
  await page.route('https://www.gstatic.com/firebasejs/**firebase-app.js', (route) => {
    route.fulfill({ contentType: 'application/javascript', body: MOCK_FIREBASE_APP_JS });
  });
  await page.route('https://www.gstatic.com/firebasejs/**firebase-auth.js', (route) => {
    route.fulfill({
      contentType: 'application/javascript',
      body: buildFirebaseAuthMock(actor),
    });
  });
  await page.route('/api/config', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ firebaseConfig: {}, imageGenEnabled: false }),
    });
  });
}

// ---------------------------------------------------------------------------
// Server API helpers (raw fetch against the real test server)
// ---------------------------------------------------------------------------

function authHeaders(actor, extra = {}) {
  return {
    Authorization: `Bearer ${actor.token}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

/** Create a new table owned by the GM actor. Returns { id, name }. */
export async function createTestTable(name = 'Multi-Actor Test') {
  const res = await fetch(`${BASE_URL}/api/my-tables`, {
    method: 'POST',
    headers: authHeaders(ACTOR_GM),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`createTestTable failed: ${res.status}`);
  return res.json();
}

/**
 * Delete a table owned by the GM.
 * Idempotent — ignores 404.  Logs (does not throw) on 500, since test table
 * cleanup failures should not mask the actual test results.
 */
export async function deleteTestTable(tableId) {
  const res = await fetch(`${BASE_URL}/api/my-tables/${tableId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${ACTOR_GM.token}` },
  });
  if (res.status === 404) return;
  if (!res.ok) {
    // Log but don't throw — cleanup failures must not mask test failures.
    const body = await res.text().catch(() => '');
    console.warn(`[multi-auth] deleteTestTable(${tableId}) ${res.status}: ${body}`);
  }
}

/**
 * Invite a list of player emails to a table (GM-only op).
 * Sends the `set-player-emails` table op to the real server.
 */
export async function invitePlayers(tableId, playerEmails) {
  const res = await fetch(`${BASE_URL}/api/room/my/op`, {
    method: 'POST',
    headers: authHeaders(ACTOR_GM),
    body: JSON.stringify({ op: 'set-player-emails', tableId, playerEmails }),
  });
  if (!res.ok) throw new Error(`invitePlayers failed: ${res.status} ${await res.text()}`);
}

/**
 * Add an adversary element to the table (GM-only add-elements op).
 * Returns the instanceId of the added adversary.
 */
export async function addAdversaryToTable(tableId, { name = 'Test Goblin', hp_max = 4, tier = 1 } = {}) {
  const instanceId = `adv-test-${Date.now()}`;
  const res = await fetch(`${BASE_URL}/api/room/my/op`, {
    method: 'POST',
    headers: authHeaders(ACTOR_GM),
    body: JSON.stringify({
      op: 'add-elements',
      tableId,
      elements: [{
        instanceId,
        elementType: 'adversary',
        id: `test-adv-${instanceId}`,
        name,
        tier,
        hp_max,
        currentHp: hp_max,
        currentStress: 0,
        conditions: '',
      }],
    }),
  });
  if (!res.ok) throw new Error(`addAdversaryToTable failed: ${res.status}`);
  return instanceId;
}

/**
 * Create (or upsert) a library `characters` item owned by `actor`.
 * Needed whenever a V2 feature needs `classId`/`subclassId`/etc. resolved —
 * those fields are NOT in CHARACTER_RUNTIME_KEYS and are only restored via
 * `resolveCharacterElements` merging in the matching library row by `id`.
 * Returns the saved item (including its `id`).
 */
export async function createLibraryCharacter(actor, data) {
  const id = data.id || `test-char-${actor.uid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await fetch(`${BASE_URL}/api/data/characters`, {
    method: 'PUT',
    headers: authHeaders(actor),
    body: JSON.stringify({ id, name: 'Test Character', ...data }),
  });
  if (!res.ok) throw new Error(`createLibraryCharacter failed: ${res.status} — ${await res.text()}`);
  return res.json();
}

/**
 * Delete a library `characters` item owned by `actor`. Idempotent — ignores 404.
 * MUST be called in `afterAll` for every test that calls `createLibraryCharacter`,
 * otherwise these rows accumulate forever in the shared test DB (every multi-actor
 * test run authenticates as the same fixed uids) and can slow down or destabilize
 * unrelated tests that load the Library (e.g. the "All" tab renders every owned
 * character alongside SRD content).
 */
export async function deleteLibraryCharacter(actor, id) {
  const res = await fetch(`${BASE_URL}/api/data/characters/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${actor.token}` },
  });
  if (res.status === 404) return;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(`[multi-auth] deleteLibraryCharacter(${id}) ${res.status}: ${body}`);
  }
}

/**
 * Add one or more raw elements to the table (GM-only add-elements op).
 * Unlike addAdversaryToTable, this does not synthesize any defaults —
 * callers pass the full element shape (e.g. character elements referencing
 * a library `id` plus runtime fields like tokenX/tokenY/assignedPlayerUid).
 */
export async function addElementsToTable(tableId, elements) {
  const res = await fetch(`${BASE_URL}/api/room/my/op`, {
    method: 'POST',
    headers: authHeaders(ACTOR_GM),
    body: JSON.stringify({ op: 'add-elements', tableId, elements }),
  });
  if (!res.ok) throw new Error(`addElementsToTable failed: ${res.status} — ${await res.text()}`);
  return elements.map((e) => e.instanceId);
}

/** GM-only update-element op (bypasses prep gate — test tables start unstarted). */
export async function updateElement(tableId, instanceId, updates) {
  const res = await fetch(`${BASE_URL}/api/room/my/op`, {
    method: 'POST',
    headers: authHeaders(ACTOR_GM),
    body: JSON.stringify({ op: 'update-element', tableId, instanceId, updates, bypassPrepGate: true }),
  });
  if (!res.ok) throw new Error(`updateElement failed: ${res.status} — ${await res.text()}`);
  return res.json();
}

/** GM-only set-table-top op (e.g. `{ sessionStarted: true }`) — required for player-initiated rolls. */
export async function setTableTop(tableId, patch) {
  const res = await fetch(`${BASE_URL}/api/room/my/op`, {
    method: 'POST',
    headers: authHeaders(ACTOR_GM),
    body: JSON.stringify({ op: 'set-table-top', tableId, top: patch }),
  });
  if (!res.ok) throw new Error(`setTableTop failed: ${res.status} — ${await res.text()}`);
  return res.json();
}

/** Fetch the resolved table_state row (as `actor`). Returns the single table row object. */
export async function getTableState(tableId, actor = ACTOR_GM) {
  const res = await fetch(`${BASE_URL}/api/data/table_state?tableId=${tableId}`, {
    headers: { Authorization: `Bearer ${actor.token}` },
  });
  if (!res.ok) throw new Error(`getTableState failed: ${res.status} — ${await res.text()}`);
  const data = await res.json();
  return Array.isArray(data.items) ? data.items[0] : data;
}

/**
 * GM fires a dice roll on the real server. Returns the roll data.
 *
 * IMPORTANT: rollText must use square-bracket notation: e.g. "Hope [1d12] Fear [1d12]"
 * or "Hope [1d12] Fear [1d12] [1d20+3] damage [1d6]". Bare dice (e.g. "1d20") are not
 * parsed by rollFromText. Use bypassPrepGate:true (default) since test tables start in
 * prep mode (sessionStarted: false).
 */
export async function gmRoll(tableId, rollText, displayName = 'GM', extraMeta = {}) {
  const res = await fetch(`${BASE_URL}/api/room/my/roll`, {
    method: 'POST',
    headers: authHeaders(ACTOR_GM),
    body: JSON.stringify({ rollText, displayName, tableId, bypassPrepGate: true, ...extraMeta }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`gmRoll failed: ${res.status} — ${body}`);
  }
  return res.json();
}

/**
 * Player fires a dice roll on the real server. Returns the roll data.
 * rollText must use square-bracket notation (same as gmRoll).
 * `extraMeta` fields MUST start with `_` (e.g. `_attackerInstanceId`) — the
 * player roll route only forwards underscore-prefixed keys (see server.js).
 * The table must have `sessionStarted: true` (via setTableTop) — unlike
 * gmRoll, player rolls cannot bypass the prep gate.
 */
export async function playerRoll(actor, tableId, rollText, displayName, extraMeta = {}) {
  const res = await fetch(`${BASE_URL}/api/room/${tableId}/roll`, {
    method: 'POST',
    headers: authHeaders(actor),
    body: JSON.stringify({ rollText, displayName: displayName ?? actor.displayName, ...extraMeta }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`playerRoll failed: ${res.status} — ${body}`);
  }
  return res.json();
}

/**
 * Cancel every currently-pending banner in the GM's shared banner queue.
 *
 * IMPORTANT: `dice_rolls` (and therefore the pending-banner queue) is keyed
 * by `gm_uid` only — NOT by tableId (see src/db.js `getPendingBanners`).
 * Since every multi-actor test in this file (and every other browser spec)
 * authenticates as the same fixed `ACTOR_GM.uid`, un-acknowledged banners
 * from earlier tests/runs persist in the DB and appear on every table's
 * banner strip. A crowded banner strip can visually/physically overlap the
 * dice-roll-chip button a test wants to click (Playwright reports "element
 * is not stable" / intercepted by an unrelated `.dice-result-banner`).
 * Call this in `beforeAll` for any test that needs a clean, predictable
 * banner strip.
 */
export async function cancelAllPendingBanners() {
  const res = await fetch(`${BASE_URL}/api/room/my/players?token=${encodeURIComponent(ACTOR_GM.token)}`);
  if (!res.ok || !res.body) { try { await res.body?.cancel(); } catch { /* ignore */ } return; }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let rolls = null;
  const deadline = Date.now() + 4000;
  try {
    while (!rolls && Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const match = buffer.match(/event: roll-history\ndata: (.*)\n\n/);
      if (match) {
        try { rolls = JSON.parse(match[1]).rolls; } catch { /* keep reading, may be a partial chunk */ }
      }
    }
  } finally {
    try { await reader.cancel(); } catch { /* ignore */ }
  }
  if (!Array.isArray(rolls)) return;
  const pendingIds = rolls.filter((r) => r._status === 'pending' && r._rollDbId).map((r) => r._rollDbId);
  await Promise.all(pendingIds.map((bannerId) => fetch(`${BASE_URL}/api/room/my/banner-ack`, {
    method: 'POST',
    headers: authHeaders(ACTOR_GM),
    body: JSON.stringify({ bannerId, action: 'cancel' }),
  }).catch(() => {})));
}

/**
 * Collect SSE events from a URL into an array.
 * Closes the connection after `durationMs` milliseconds.
 * Returns { events: [{ type, data }] }.
 *
 * Each item has:
 *   type  — the SSE `event:` field (default 'message')
 *   data  — parsed JSON (or raw string if not JSON)
 */
export async function collectSseEvents(page, url, { durationMs = 2000, eventTypes = null } = {}) {
  return page.evaluate(
    ({ url, durationMs, eventTypes }) => {
      return new Promise((resolve) => {
        const es = new EventSource(url);
        const collected = [];
        const done = () => { es.close(); resolve(collected); };
        const timer = setTimeout(done, durationMs);

        const handle = (type) => (e) => {
          let data;
          try { data = JSON.parse(e.data); } catch { data = e.data; }
          collected.push({ type, data });
        };

        const types = eventTypes || ['message', 'banners', 'table_state', 'roll-log-append', 'presence'];
        for (const t of types) {
          es.addEventListener(t, handle(t));
        }
        es.onerror = () => { clearTimeout(timer); done(); };
      });
    },
    { url, durationMs, eventTypes },
  );
}
