/**
 * Unit tests for orphaned Playwright test-table cleanup
 * (test/helpers/cleanup-test-tables.js).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  isTestGmUserId,
  cleanupOrphanedTestTablesWithDb,
} from '../helpers/cleanup-test-tables.js';

describe('isTestGmUserId', () => {
  it('matches the default multi-actor GM uid', () => {
    expect(isTestGmUserId('test-user-uid')).toBe(true);
  });

  it('matches namespaced GM uids (worker / agent NS)', () => {
    expect(isTestGmUserId('test-user-uid-w0')).toBe(true);
    expect(isTestGmUserId('test-user-uid-guardian')).toBe(true);
    expect(isTestGmUserId('test-user-uid-w1-foo')).toBe(true);
  });

  it('rejects non-test and player uids', () => {
    expect(isTestGmUserId('test-player-a-uid')).toBe(false);
    expect(isTestGmUserId('test-user')).toBe(false);
    expect(isTestGmUserId('real-firebase-uid')).toBe(false);
    expect(isTestGmUserId('')).toBe(false);
    expect(isTestGmUserId(null)).toBe(false);
  });
});

describe('cleanupOrphanedTestTablesWithDb', () => {
  it('no-ops when there are no orphaned tables', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [] });
    const result = await cleanupOrphanedTestTablesWithDb({ query }, 'app');
    expect(result).toEqual({ deletedTableIds: [], gmUserIds: [] });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('deletes placements, campaign passes, then table_state rows', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({
        rows: [
          { id: 'table-a', user_id: 'test-user-uid' },
          { id: 'table-b', user_id: 'test-user-uid-w0' },
        ],
      })
      .mockResolvedValue({ rows: [], rowCount: 0 });

    const result = await cleanupOrphanedTestTablesWithDb({ query }, 'app');

    expect(result.deletedTableIds).toEqual(['table-a', 'table-b']);
    expect(result.gmUserIds.sort()).toEqual(['test-user-uid', 'test-user-uid-w0']);
    expect(query).toHaveBeenCalledTimes(4);

    expect(query.mock.calls[1][0]).toMatch(/character_table_placements/);
    expect(query.mock.calls[1][1]).toEqual(['app', ['table-a', 'table-b']]);

    expect(query.mock.calls[2][0]).toMatch(/table_campaign_passes/);
    expect(query.mock.calls[2][1]).toEqual(['app', ['table-a', 'table-b']]);

    expect(query.mock.calls[3][0]).toMatch(/DELETE FROM items/);
    expect(query.mock.calls[3][1]).toEqual(['app', ['table-a', 'table-b']]);
  });
});
