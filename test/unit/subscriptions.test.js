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
  invalidateCharacterLibraryCache: vi.fn(),
  listTableStates: vi.fn(),
  getTableStatesByPlayerEmail: vi.fn(),
  listPublicTables: vi.fn(),
  toTableCardDto: vi.fn((row, opts) => {
    const id = row?.id;
    const name = row?.data?.tableName || 'Table';
    if (opts?.tableIdKey === 'tableId') return { tableId: id, gmUid: row?.userId || '', tableName: name, name };
    return { id, name };
  }),
  summarizeTableCharacterRoster: vi.fn(() => ({ count: 0, names: [] })),
}));

// Mock session-countdowns so we can assert player-audience redaction without
// depending on the real redaction implementation.
vi.mock('../../src/client/lib/session-countdowns.js', () => ({
  redactTableStateForPlayerAudience: vi.fn((snapshot) => ({ ...snapshot, _redactedForPlayer: true })),
  redactTableStateForSpectatorAudience: vi.fn((snapshot) => ({ ...snapshot, _redactedForSpectator: true })),
}));

import { getPendingBanners, getResolvedTableState, invalidateCharacterLibraryCache, listTableStates, getTableStatesByPlayerEmail, listPublicTables } from '../../src/db.js';
import { redactTableStateForPlayerAudience, redactTableStateForSpectatorAudience } from '../../src/client/lib/session-countdowns.js';

// Import the module. Because it's a singleton, import once and reset state
// between tests manually.
const { default: manager, buildSseEventString } = await import('../../src/subscriptions.js');

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
    manager._lastSentPayload = new WeakMap();
    isFirstBannersSnapshotRef_reset();
    getPendingBanners.mockReset();
    getResolvedTableState.mockReset();
    redactTableStateForPlayerAudience.mockClear();
    redactTableStateForSpectatorAudience.mockClear();
    invalidateCharacterLibraryCache.mockClear();
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

  it('broadcastBannersChannelEvent sends a custom event to all banners subscribers', async () => {
    getPendingBanners.mockResolvedValue([]);
    const res1 = makeFakeRes();
    const res2 = makeFakeRes();
    manager.subscribe('banners', 'gm-bcast', res1);
    manager.subscribe('banners', 'gm-bcast', res2);
    await vi.runAllTimersAsync();
    await Promise.resolve();
    const payload = { roll: { _rollDbId: 42, _action: true } };
    manager.broadcastBannersChannelEvent('gm-bcast', 'roll-log-append', payload);
    expect(res1.writes.some(w => w.includes('roll-log-append'))).toBe(true);
    expect(res2.writes.some(w => w.includes('roll-log-append'))).toBe(true);
    expect(res1.writes.some(w => w.includes(JSON.stringify(payload)))).toBe(true);
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

  // ── Dedupe tests ─────────────────────────────────────────────────────────────

  it('dedupe: notifyChange with unchanged data does not write again to the same subscriber', async () => {
    const snapshot = [{ _rollDbId: 1 }];
    getPendingBanners.mockResolvedValue(snapshot);

    const res = makeFakeRes();
    manager.subscribe('banners', 'gm-dedup1', res);
    await vi.runAllTimersAsync();
    await Promise.resolve();

    const writesAfterSubscribe = res.writes.length;
    expect(writesAfterSubscribe).toBe(1); // initial push

    // notifyChange returns the same snapshot → should NOT write again
    manager.notifyChange('banners', 'gm-dedup1');
    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(res.writes.length).toBe(writesAfterSubscribe); // no new write
  });

  it('dedupe: notifyChange with changed data always sends to the subscriber', async () => {
    const snapshot1 = [{ _rollDbId: 1 }];
    const snapshot2 = [{ _rollDbId: 2 }];
    getPendingBanners.mockResolvedValueOnce(snapshot1);

    const res = makeFakeRes();
    manager.subscribe('banners', 'gm-dedup2', res);
    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(res.writes.length).toBe(1);

    getPendingBanners.mockResolvedValue(snapshot2);
    manager.notifyChange('banners', 'gm-dedup2');
    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(res.writes.length).toBe(2);
    expect(res.writes[1]).toContain(JSON.stringify(snapshot2));
  });

  it('dedupe: a brand-new subscriber always receives the first push even if payload matches cached state', async () => {
    const snapshot = [{ _rollDbId: 10 }];
    getPendingBanners.mockResolvedValue(snapshot);

    // Subscribe res1 first — gets the payload cached in its WeakMap entry
    const res1 = makeFakeRes();
    manager.subscribe('banners', 'gm-dedup3', res1);
    await vi.runAllTimersAsync();
    await Promise.resolve();
    expect(res1.writes.length).toBe(1);

    // Subscribe res2 (brand-new, no WeakMap entry) to the same key with the same snapshot
    const res2 = makeFakeRes();
    manager.subscribe('banners', 'gm-dedup3', res2);
    await vi.runAllTimersAsync();
    await Promise.resolve();

    // res2 should receive the push even though the payload equals what res1 received
    expect(res2.writes.length).toBe(1);
    expect(res2.writes[0]).toContain(JSON.stringify(snapshot));
  });

  it('dedupe: double-fire from direct notify + Postgres trigger results in only one write', async () => {
    const snapshot = { elements: [], fearCount: 0 };
    getResolvedTableState.mockResolvedValue(snapshot);

    const res = makeFakeRes();
    manager.subscribe('table_state', 'gm-dedup4', res);
    await vi.runAllTimersAsync();
    await Promise.resolve();
    expect(res.writes.length).toBe(1);

    // Simulate the direct notifyChange + Postgres trigger double-fire pattern:
    // both calls collapse to one debounced DB query, and the resulting identical
    // snapshot should not produce a second write to the already-current subscriber.
    manager.notifyChange('table_state', 'gm-dedup4');
    manager.notifyChange('table_state', 'gm-dedup4'); // second fire (would be separate without debounce)
    await vi.runAllTimersAsync();
    await Promise.resolve();

    // Still only 1 write total — debounce collapses the two notifyChanges,
    // and dedupe skips the write since the snapshot is identical.
    expect(res.writes.length).toBe(1);
  });

  // ── character_item_changed cross-process handling ─────────────────────────────
  // This is the mechanism that fixes stale character data (name/stats/image) on a
  // different server process than the one that handled the character save — see
  // migrations/036_character_item_change_notify.sql for the Postgres side.

  it('_handleCharacterItemChanged invalidates the character cache for the payload id', async () => {
    manager._handleCharacterItemChanged(JSON.stringify({ id: 'char-abc' }));
    expect(invalidateCharacterLibraryCache).toHaveBeenCalledWith('test-app', 'char-abc');
  });

  it('_handleCharacterItemChanged re-pushes every currently-subscribed table_state key on this process', async () => {
    const snapshot = { elements: [{ instanceId: 'x', elementType: 'character', id: 'char-abc' }], fearCount: 0 };
    getResolvedTableState.mockResolvedValue(snapshot);

    const res1 = makeFakeRes();
    const res2 = makeFakeRes();
    manager.subscribe('table_state', 'tbl-1', res1);
    manager.subscribe('table_state', 'tbl-2', res2);
    await vi.runAllTimersAsync();
    await Promise.resolve();
    await Promise.resolve();
    getResolvedTableState.mockClear();

    // Return a fresh object each time so the dedupe check (which compares serialized
    // strings, not object identity) doesn't suppress the write — the point here is
    // that both table_state keys get re-queried and pushed, not the dedupe behavior.
    getResolvedTableState.mockResolvedValue({ ...snapshot, fearCount: 1 });

    manager._handleCharacterItemChanged(JSON.stringify({ id: 'char-abc' }));
    await vi.runAllTimersAsync();
    await Promise.resolve();
    await Promise.resolve();

    expect(getResolvedTableState).toHaveBeenCalledWith('test-app', 'tbl-1');
    expect(getResolvedTableState).toHaveBeenCalledWith('test-app', 'tbl-2');
    expect(res1.writes.length).toBe(2);
    expect(res2.writes.length).toBe(2);
  });

  it('_handleCharacterItemChanged with a malformed payload does not throw and is a no-op', () => {
    expect(() => manager._handleCharacterItemChanged('not json')).not.toThrow();
    expect(invalidateCharacterLibraryCache).not.toHaveBeenCalled();
  });

  it('_handleCharacterItemChanged with no active table_state subscribers is a no-op beyond cache invalidation', () => {
    manager._handleCharacterItemChanged(JSON.stringify({ id: 'char-xyz' }));
    expect(invalidateCharacterLibraryCache).toHaveBeenCalledWith('test-app', 'char-xyz');
    // No table_state subscribers registered in this test — nothing further to assert
    // beyond "doesn't throw", which the lack of an exception here already proves.
  });

  // ── Per-audience stringify tests ──────────────────────────────────────────────

  it('table_state: GM subscriber receives non-redacted snapshot', async () => {
    const snapshot = { elements: [], fearCount: 2, sessionCountdowns: [{ id: 'cd1' }] };
    getResolvedTableState.mockResolvedValue(snapshot);

    const res = makeFakeRes();
    manager.subscribe('table_state', 'tbl-aud1', res, { tableStateAudience: 'gm' });
    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(res.writes.length).toBe(1);
    expect(res.writes[0]).toContain(JSON.stringify(snapshot));
    // GM gets raw snapshot — redact function should NOT have been called
    expect(redactTableStateForPlayerAudience).not.toHaveBeenCalled();
  });

  it('table_state: player subscriber receives redacted snapshot', async () => {
    const snapshot = { elements: [], fearCount: 2, sessionCountdowns: [{ id: 'cd1' }] };
    getResolvedTableState.mockResolvedValue(snapshot);

    const res = makeFakeRes();
    manager.subscribe('table_state', 'tbl-aud2', res, { tableStateAudience: 'player' });
    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(res.writes.length).toBe(1);
    // The mock redact function adds _redactedForPlayer: true
    const expectedRedacted = { ...snapshot, _redactedForPlayer: true };
    expect(res.writes[0]).toContain(JSON.stringify(expectedRedacted));
    expect(redactTableStateForPlayerAudience).toHaveBeenCalledWith(snapshot);
  });

  it('table_state: spectator subscriber receives spectator-redacted snapshot', async () => {
    const snapshot = { elements: [], fearCount: 2, playerEmails: ['a@b.com'] };
    getResolvedTableState.mockResolvedValue(snapshot);

    const res = makeFakeRes();
    manager.subscribe('table_state', 'tbl-aud-spec', res, { tableStateAudience: 'spectator' });
    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(res.writes.length).toBe(1);
    const expectedRedacted = { ...snapshot, _redactedForSpectator: true };
    expect(res.writes[0]).toContain(JSON.stringify(expectedRedacted));
    expect(redactTableStateForSpectatorAudience).toHaveBeenCalledWith(snapshot);
    expect(redactTableStateForPlayerAudience).not.toHaveBeenCalled();
  });

  it('table_state: with one GM and one player subscriber, redact is called exactly once per push', async () => {
    const snapshot = { elements: [], fearCount: 0 };
    getResolvedTableState.mockResolvedValue(snapshot);

    const gmRes = makeFakeRes();
    const playerRes = makeFakeRes();

    // Subscribe both to the same key, then trigger one notifyChange
    manager.subscribe('table_state', 'tbl-aud3', gmRes, { tableStateAudience: 'gm' });
    manager.subscribe('table_state', 'tbl-aud3', playerRes, { tableStateAudience: 'player' });
    await vi.runAllTimersAsync();
    await Promise.resolve();
    await Promise.resolve();
    redactTableStateForPlayerAudience.mockClear();

    // Single notifyChange that delivers to both subscribers in one _pushSnapshot call
    getResolvedTableState.mockResolvedValue({ ...snapshot, fearCount: 1 });
    manager.notifyChange('table_state', 'tbl-aud3');
    await vi.runAllTimersAsync();
    await Promise.resolve();

    // redact called exactly once per push, not once per client
    expect(redactTableStateForPlayerAudience).toHaveBeenCalledTimes(1);
    // GM gets the non-redacted payload
    expect(gmRes.writes.some(w => w.includes('"_redactedForPlayer"'))).toBe(false);
    // Player gets the redacted payload
    expect(playerRes.writes.some(w => w.includes('"_redactedForPlayer":true'))).toBe(true);
  });
});

// ── buildSseEventString pure helper tests ─────────────────────────────────────

describe('buildSseEventString', () => {
  beforeEach(() => {
    redactTableStateForPlayerAudience.mockClear();
  });

  it('formats SSE event string correctly for a banners channel', () => {
    const snapshot = [{ _rollDbId: 1 }];
    const str = buildSseEventString('banners', snapshot, undefined);
    expect(str).toBe(`event: banners\ndata: ${JSON.stringify(snapshot)}\n\n`);
  });

  it('for table_state GM audience, uses raw snapshot without calling redact', () => {
    const snapshot = { elements: [], fearCount: 3 };
    const str = buildSseEventString('table_state', snapshot, 'gm');
    expect(str).toBe(`event: table_state\ndata: ${JSON.stringify(snapshot)}\n\n`);
    expect(redactTableStateForPlayerAudience).not.toHaveBeenCalled();
  });

  it('for table_state player audience, calls redact and uses redacted data', () => {
    const snapshot = { elements: [], fearCount: 3 };
    const str = buildSseEventString('table_state', snapshot, 'player');
    const expectedRedacted = { ...snapshot, _redactedForPlayer: true };
    expect(str).toBe(`event: table_state\ndata: ${JSON.stringify(expectedRedacted)}\n\n`);
    expect(redactTableStateForPlayerAudience).toHaveBeenCalledWith(snapshot);
  });

  it('for table_state spectator audience, calls spectator redact', () => {
    const snapshot = { elements: [], fearCount: 3 };
    const str = buildSseEventString('table_state', snapshot, 'spectator');
    const expectedRedacted = { ...snapshot, _redactedForSpectator: true };
    expect(str).toBe(`event: table_state\ndata: ${JSON.stringify(expectedRedacted)}\n\n`);
    expect(redactTableStateForSpectatorAudience).toHaveBeenCalledWith(snapshot);
    expect(redactTableStateForPlayerAudience).not.toHaveBeenCalled();
  });

  it('produces the same string when called twice with identical args (pure/stable)', () => {
    const snapshot = { elements: [{ instanceId: 'abc' }], fearCount: 0 };
    const str1 = buildSseEventString('table_state', snapshot, 'gm');
    const str2 = buildSseEventString('table_state', snapshot, 'gm');
    expect(str1).toBe(str2);
  });
});

// Vitest doesn't automatically reset module-level mutable state; this is a no-op
// placeholder so the describe block can reset the flag if needed.
function isFirstBannersSnapshotRef_reset() {}

// ── Home-lobby channels ────────────────────────────────────────────────────

describe('home-lobby channels', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    manager._appId = 'test-app';
    manager._subs = new Map();
    manager._pending = new Map();
    manager._lastSentPayload = new WeakMap();
    listTableStates.mockReset();
    getTableStatesByPlayerEmail.mockReset();
    listPublicTables.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('home_owned subscribe calls listTableStates and pushes an SSE snapshot', async () => {
    const tables = [{ id: 't1', name: 'My Table' }];
    listTableStates.mockResolvedValue([{ id: 't1', data: { tableName: 'My Table' } }]);

    const res = makeFakeRes();
    manager.subscribe('home_owned', 'uid-gm', res);
    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(listTableStates).toHaveBeenCalledWith('test-app', 'uid-gm');
    expect(res.writes.length).toBe(1);
    expect(res.writes[0]).toContain('event: home_owned');
  });

  it('home_invited snapshot includes tableId from getTableStatesByPlayerEmail rows', async () => {
    getTableStatesByPlayerEmail.mockResolvedValue([
      { tableId: 'tbl-invited', userId: 'gm-1', data: { tableName: 'Hunt' } },
    ]);

    const res = makeFakeRes();
    manager.subscribe('home_invited', 'alice@example.com', res);
    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(getTableStatesByPlayerEmail).toHaveBeenCalledWith('test-app', 'alice@example.com');
    expect(res.writes[0]).toContain('event: home_invited');
    const dataLine = res.writes[0].split('\n').find((line) => line.startsWith('data: '));
    const rooms = JSON.parse(dataLine.slice(6));
    expect(rooms[0].tableId).toBe('tbl-invited');
    expect(rooms[0].tableId).not.toBeUndefined();
  });

  it('home_public subscribe calls listPublicTables', async () => {
    listPublicTables.mockResolvedValue([]);

    const res = makeFakeRes();
    manager.subscribe('home_public', 'all', res);
    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(listPublicTables).toHaveBeenCalledWith('test-app', { limit: 3 });
    expect(res.writes.length).toBe(1);
    expect(res.writes[0]).toContain('event: home_public');
  });

  it('_handleHomeLobbyChanged fans out to owner, emails, and public', () => {
    const notifySpy = vi.spyOn(manager, 'notifyChange');
    manager._handleHomeLobbyChanged(JSON.stringify({
      owner_uid: 'uid-gm',
      player_emails: ['alice@test.com', 'bob@test.com'],
      notify_public: true,
    }));
    expect(notifySpy).toHaveBeenCalledWith('home_owned', 'uid-gm');
    expect(notifySpy).toHaveBeenCalledWith('home_invited', 'alice@test.com');
    expect(notifySpy).toHaveBeenCalledWith('home_invited', 'bob@test.com');
    expect(notifySpy).toHaveBeenCalledWith('home_public', 'all');
    notifySpy.mockRestore();
  });

  it('_handleHomeLobbyChanged does not notify home_public when notify_public is false', () => {
    const notifySpy = vi.spyOn(manager, 'notifyChange');
    manager._handleHomeLobbyChanged(JSON.stringify({
      owner_uid: 'uid-gm',
      player_emails: [],
      notify_public: false,
    }));
    expect(notifySpy).not.toHaveBeenCalledWith('home_public', 'all');
    notifySpy.mockRestore();
  });

  it('_handleHomeLobbyChanged is robust against malformed JSON', () => {
    expect(() => manager._handleHomeLobbyChanged('not-json')).not.toThrow();
  });
});
