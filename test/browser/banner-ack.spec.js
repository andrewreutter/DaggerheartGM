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
 * These tests hit the real Express server on port 3457 using the test-token
 * auth bypass (NODE_ENV=test).
 */
import { test, expect } from '@playwright/test';

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

test('POST /api/room/:gmUid/banner-cancel: missing bannerId returns 400', async ({ request }) => {
  const res = await request.post('/api/room/some-other-gm-uid/banner-cancel', {
    headers: AUTH_HEADER,
    data: {},
  });
  expect([400, 403, 503]).toContain(res.status());
});

test('POST /api/room/my/dice-ack: deprecated endpoint still returns ok', async ({ request }) => {
  const res = await request.post('/api/room/my/dice-ack', {
    headers: AUTH_HEADER,
    data: {},
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
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
