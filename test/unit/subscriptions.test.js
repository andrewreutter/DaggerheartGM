/**
 * Unit tests for src/subscriptions.js — SubscriptionManager.
 *
 * Tests the subscribe / unsubscribe / notifyChange lifecycle without
 * a real Postgres connection (DATABASE_URL is unset, so init() is a no-op).
 *
 * The tests verify that:
 * - subscribe() immediately calls _pushSnapshot (we inject a mock query fn)
 * - notifyChange() debounces and calls _pushSnapshot once
 * - unsubscribe() stops delivery
 * - multiple subscribers receive independent snapshots
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocking the DB layer ──────────────────────────────────────────────────────
// We inject fake DB functions so SubscriptionManager can be tested
// without a real database.
vi.mock('../../src/db.js', () => ({
  getPendingBanners: vi.fn(),
  getResolvedTableState: vi.fn(),
}));

import { getPendingBanners, getResolvedTableState } from '../../src/db.js';

// Import the module. Because it's a singleton, import once and reset state
// between tests manually.
const { default: manager } = await import('../../src/subscriptions.js');

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeFakeRes() {
  const writes = [];
  return {
    writableEnded: false,
    writes,
    write(data) { this.writes.push(data); },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SubscriptionManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set APP_ID so _pushSnapshot runs
    manager._appId = 'test-app';
    // Reset all subscriptions between tests
    manager._subs = new Map();
    manager._pending = new Map();
    isFirstBannersSnapshotRef_reset();
    getPendingBanners.mockReset();
    getResolvedTableState.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('subscribe sends an immediate snapshot to the new subscriber', async () => {
    const snapshot = [{ _rollDbId: 1, rollUser: 'Alice' }];
    getPendingBanners.mockResolvedValue(snapshot);

    const res = makeFakeRes();
    manager.subscribe('banners', 'gm-123', res);

    // Flush the async _pushSnapshot
    await vi.runAllTimersAsync();
    // At least one pending-microtasks flush:
    await Promise.resolve();

    expect(getPendingBanners).toHaveBeenCalledWith('test-app', 'gm-123');
    expect(res.writes.length).toBe(1);
    expect(res.writes[0]).toContain('event: banners');
    expect(res.writes[0]).toContain(JSON.stringify(snapshot));
  });

  it('unsubscribe prevents further deliveries', async () => {
    getPendingBanners.mockResolvedValue([]);

    const res = makeFakeRes();
    manager.subscribe('banners', 'gm-456', res);
    await vi.runAllTimersAsync();
    await Promise.resolve();

    const initialCount = res.writes.length;

    manager.unsubscribe('banners', 'gm-456', res);
    manager.notifyChange('banners', 'gm-456');
    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(res.writes.length).toBe(initialCount); // no new writes
  });

  it('notifyChange debounces rapid calls into one query', async () => {
    getPendingBanners.mockResolvedValue([]);

    const res = makeFakeRes();
    manager.subscribe('banners', 'gm-789', res);
    await vi.runAllTimersAsync();
    await Promise.resolve();
    getPendingBanners.mockClear();

    // Fire several rapid notifyChange calls
    manager.notifyChange('banners', 'gm-789');
    manager.notifyChange('banners', 'gm-789');
    manager.notifyChange('banners', 'gm-789');

    // Before debounce window: no extra queries
    expect(getPendingBanners).not.toHaveBeenCalled();

    // After debounce window: exactly one query
    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(getPendingBanners).toHaveBeenCalledTimes(1);
  });

  it('multiple subscribers for the same key all receive snapshots', async () => {
    const snapshot = [{ _rollDbId: 99 }];
    getPendingBanners.mockResolvedValue(snapshot);

    const res1 = makeFakeRes();
    const res2 = makeFakeRes();
    manager.subscribe('banners', 'gm-multi', res1);
    manager.subscribe('banners', 'gm-multi', res2);
    await vi.runAllTimersAsync();
    await Promise.resolve();
    await Promise.resolve(); // double flush for two separate _pushSnapshot calls

    expect(res1.writes.length).toBeGreaterThanOrEqual(1);
    expect(res2.writes.length).toBeGreaterThanOrEqual(1);
    expect(res1.writes[0]).toContain(JSON.stringify(snapshot));
  });

  it('does not write to a res that has writableEnded=true', async () => {
    getPendingBanners.mockResolvedValue([{ _rollDbId: 1 }]);

    const res = makeFakeRes();
    res.writableEnded = true;
    manager.subscribe('banners', 'gm-ended', res);
    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(res.writes.length).toBe(0);
  });

  it('table_state channel sends resolved state snapshot on subscribe', async () => {
    const snapshot = { elements: [{ instanceId: 'abc', elementType: 'adversary' }], fearCount: 2 };
    getResolvedTableState.mockResolvedValue(snapshot);

    const res = makeFakeRes();
    manager.subscribe('table_state', 'gm-ts1', res);
    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(getResolvedTableState).toHaveBeenCalledWith('test-app', 'gm-ts1');
    expect(res.writes.length).toBe(1);
    expect(res.writes[0]).toContain('event: table_state');
    expect(res.writes[0]).toContain(JSON.stringify(snapshot));
  });

  it('table_state notifyChange delivers updated snapshot to all subscribers', async () => {
    const snapshot1 = { elements: [], fearCount: 0 };
    const snapshot2 = { elements: [{ instanceId: 'x', elementType: 'adversary' }], fearCount: 1 };
    getResolvedTableState.mockResolvedValueOnce(snapshot1).mockResolvedValueOnce(snapshot2);

    const res = makeFakeRes();
    manager.subscribe('table_state', 'gm-ts2', res);
    await vi.runAllTimersAsync();
    await Promise.resolve();

    getResolvedTableState.mockClear();
    getResolvedTableState.mockResolvedValue(snapshot2);

    manager.notifyChange('table_state', 'gm-ts2');
    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(getResolvedTableState).toHaveBeenCalledTimes(1);
    expect(res.writes.length).toBe(2);
    expect(res.writes[1]).toContain(JSON.stringify(snapshot2));
  });
});

// Vitest doesn't automatically reset module-level mutable state; this is a no-op
// placeholder so the describe block can reset the flag if needed.
function isFirstBannersSnapshotRef_reset() {}
