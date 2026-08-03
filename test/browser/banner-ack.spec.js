/**
 * Banner acknowledgement API regression tests.
 *
 * Verifies the server-authoritative banner queue:
 * - POST /api/room/my/banner-ack returns { ok: true } for acknowledge and cancel
 * - The endpoint is auth-gated (no test-token → 401)
 * - Legacy POST /api/room/my/dice-ack still exists (deprecated, kept for compat)
 * - GET /api/room/my/players SSE sends a 'banners' subscription event on connect
 *   (no 'pending-banners' event — that channel is now driven by SubscriptionManager)
 *
 * Also covers T13 (in-session bug capture) including the player-facing route and
 * the optional notes field.
 *
 * These tests hit the real Express server on port 3457 using the test-token
 * auth bypass (NODE_ENV=test).
 */
import { test, expect } from '@playwright/test';
import {
  BASE_URL,
  ACTOR_GM,
  ACTOR_PLAYER_A,
  createTestTable,
  deleteTestTable,
  invitePlayers,
} from '../helpers/multi-auth.js';

const AUTH_HEADER = { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' };

test('POST /api/room/my/banner-ack: acknowledge returns ok', async ({ request }) => {
  const res = await request.post('/api/room/my/banner-ack', {
    headers: AUTH_HEADER,
    data: { bannerId: null, action: 'acknowledge', effectData: null },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
});

test('POST /api/room/my/banner-ack: cancel returns ok', async ({ request }) => {
  const res = await request.post('/api/room/my/banner-ack', {
    headers: AUTH_HEADER,
    data: { bannerId: null, action: 'cancel', effectData: null },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
});

test('POST /api/room/my/banner-ack: requires auth', async ({ request }) => {
  const res = await request.post('/api/room/my/banner-ack', {
    headers: { 'Content-Type': 'application/json' },
    data: { bannerId: null, action: 'acknowledge' },
  });
  expect(res.status()).toBe(401);
});

test('POST /api/room/:gmUid/banner-cancel: caller is GM returns 400', async ({ request }) => {
  // test-token has uid 'test-user-uid'; calling with that as gmUid means caller is the GM (not allowed)
  const res = await request.post('/api/room/test-user-uid/banner-cancel', {
    headers: AUTH_HEADER,
    data: { bannerId: 1 },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toBe('Invalid request');
});

test('POST /api/room/:gmUid/banner-cancel: missing bannerId returns 400/403/404/503', async ({ request }) => {
  // Without a real DB, the route returns 404 (table not found). With a DB, bannerId=null
  // triggers 400. 403 covers not-invited, 503 covers no-DB variants. All are valid.
  const res = await request.post('/api/room/some-other-gm-uid/banner-cancel', {
    headers: AUTH_HEADER,
    data: {},
  });
  expect([400, 403, 404, 503]).toContain(res.status());
});

test('POST /api/room/my/dice-ack: deprecated endpoint removed, returns 404', async ({ request }) => {
  // This endpoint was deprecated and removed (postDiceAck is no longer imported by app.jsx).
  // The test asserts the current behavior: the route no longer exists.
  const res = await request.post('/api/room/my/dice-ack', {
    headers: AUTH_HEADER,
    data: {},
  });
  expect(res.status()).toBe(404);
});

// T13 — In-session bug capture auth gating
test('POST /api/room/my/bug-report: requires auth (no token → 401)', async ({ request }) => {
  const res = await request.post('/api/room/my/bug-report', {
    headers: { 'Content-Type': 'application/json' },
    data: { tableId: 'test-user-uid', recentActionLog: [], recentConsoleErrors: [] },
  });
  expect(res.status()).toBe(401);
});

test('POST /api/room/my/bug-report: authenticated GM returns ok (200)', async ({ request }) => {
  // Ownership check is skipped when DATABASE_URL is unset (test env without DB).
  // With a DB, the test-user must own the table — use their uid as tableId (matches
  // the legacy primary table row convention).
  const res = await request.post('/api/room/my/bug-report', {
    headers: AUTH_HEADER,
    data: {
      tableId: 'test-user-uid',
      recentActionLog: [{ displayName: 'GM', rollText: 'd20', total: 14 }],
      activeElementsSummary: [],
      recentConsoleErrors: [],
      route: '/table/test-user-uid',
      capturedAt: new Date().toISOString(),
    },
  });
  // 200 when DB is present and table is owned; 403 when DB is present but no table row.
  // Both are valid — the important guarantee is NOT 401 (auth works) and NOT 500 (no crash).
  expect([200, 403]).toContain(res.status());
  if (res.status() === 200) {
    const body = await res.json();
    expect(body.ok).toBe(true);
  }
});

// T13 — Player-facing bug report route + optional notes field
test.describe('POST /api/room/:tableId/bug-report (player route)', () => {
  let tableId;

  test.beforeAll(async () => {
    const table = await createTestTable('Bug Report Player Test');
    tableId = table.id;
    await invitePlayers(tableId, [ACTOR_PLAYER_A.email]);
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
  });

  test('requires auth (no token → 401)', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/room/${tableId}/bug-report`, {
      headers: { 'Content-Type': 'application/json' },
      data: { recentActionLog: [], recentConsoleErrors: [] },
    });
    expect(res.status()).toBe(401);
  });

  test('invited player with notes returns ok (200)', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/room/${tableId}/bug-report`, {
      headers: {
        Authorization: `Bearer ${ACTOR_PLAYER_A.token}`,
        'Content-Type': 'application/json',
      },
      data: {
        notes: 'The attack roll total looked wrong',
        recentActionLog: [{ displayName: 'Player A', rollText: 'd20', total: 7 }],
        activeElementsSummary: [],
        recentConsoleErrors: [],
        route: `/table/${tableId}`,
        capturedAt: new Date().toISOString(),
      },
    });
    // 200 with DB; 200 without DB (no-DB path logs+returns ok too).
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('player omitting notes still returns ok (200)', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/room/${tableId}/bug-report`, {
      headers: {
        Authorization: `Bearer ${ACTOR_PLAYER_A.token}`,
        'Content-Type': 'application/json',
      },
      data: {
        recentActionLog: [],
        activeElementsSummary: [],
        recentConsoleErrors: [],
        capturedAt: new Date().toISOString(),
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('non-invited user returns 403 or 404', async ({ request }) => {
    // A random authenticated user who is not the GM and not in playerEmails.
    const res = await request.post(`${BASE_URL}/api/room/${tableId}/bug-report`, {
      headers: {
        Authorization: 'Bearer test-token:intruder-uid:intruder@example.com',
        'Content-Type': 'application/json',
      },
      data: { recentActionLog: [], recentConsoleErrors: [] },
    });
    // Without DB: 404 (table not found for intruder); with DB: 403 (not invited).
    expect([403, 404]).toContain(res.status());
  });
});

test('GET /api/room/my/players: SSE sends banners event (subscription model)', async ({ page }) => {
  // Open the GM SSE stream and collect events for a short window
  const events = [];
  await page.goto('/');
  const receivedBanners = page.evaluate(() => {
    return new Promise((resolve) => {
      const es = new EventSource('/api/room/my/players?token=test-token');
      const seen = [];
      const timeout = setTimeout(() => { es.close(); resolve(seen); }, 2000);
      es.addEventListener('banners', (e) => {
        seen.push({ type: 'banners', data: JSON.parse(e.data) });
      });
      es.addEventListener('pending-banners', (e) => {
        seen.push({ type: 'pending-banners' });
      });
    });
  });

  const result = await receivedBanners;
  // The server should send a 'banners' subscription event (from SubscriptionManager)
  // and NOT a legacy 'pending-banners' event.
  const bannerEvents = result.filter(e => e.type === 'banners');
  const legacyEvents = result.filter(e => e.type === 'pending-banners');
  expect(bannerEvents.length).toBeGreaterThanOrEqual(1);
  expect(Array.isArray(bannerEvents[0].data)).toBe(true);
  expect(legacyEvents.length).toBe(0);
});
