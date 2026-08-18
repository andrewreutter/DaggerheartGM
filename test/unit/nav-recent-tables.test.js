import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  NAV_RECENT_TABLE_LIMIT,
  TABLE_NAV_ACCESS_MAX_ENTRIES,
  collectNavTableEntries,
  navTableDisplayLabel,
  parseTableNavAccessMap,
  pickRecentNavTables,
  shouldShowNavMoreTables,
  stampTableNavAccess,
  tableNavAccessStorageKey,
} from '../../src/client/lib/nav-recent-tables.js';

describe('navTableDisplayLabel', () => {
  it('uses a real name and falls back past New Table', () => {
    expect(navTableDisplayLabel('Crossroads')).toBe('Crossroads');
    expect(navTableDisplayLabel('New Table', 'Dana')).toBe("Dana's Game Table");
    expect(navTableDisplayLabel('', null)).toBe('Game Table');
  });
});

describe('collectNavTableEntries', () => {
  it('lists owned tables then invited rooms and dedupes by id', () => {
    const entries = collectNavTableEntries(
      [
        { id: 'a', name: 'Alpha', updatedAt: 10 },
        { id: 'b', name: 'Bravo', updatedAt: 20 },
      ],
      [
        { tableId: 'b', tableName: 'Bravo Room', gmName: 'GM' },
        { tableId: 'c', tableName: 'Charlie', gmName: 'Dana', updatedAt: 30 },
      ],
    );
    expect(entries.map((e) => e.tableId)).toEqual(['a', 'b', 'c']);
    expect(entries[1].label).toBe('Bravo');
    expect(entries[2].label).toBe('Charlie');
  });

  it('accepts invited rooms that use id instead of tableId', () => {
    const entries = collectNavTableEntries(
      [],
      [{ id: 'inv-1', name: 'Hunt', gmName: 'Dana' }],
    );
    expect(entries.map((e) => e.tableId)).toEqual(['inv-1']);
  });
});

describe('pickRecentNavTables', () => {
  const entries = collectNavTableEntries(
    [
      { id: 'a', name: 'Alpha', updatedAt: 1 },
      { id: 'b', name: 'Bravo', updatedAt: 2 },
      { id: 'c', name: 'Charlie', updatedAt: 3 },
      { id: 'd', name: 'Delta', updatedAt: 4 },
    ],
    [],
  );

  it('keeps the default limit at 3', () => {
    expect(NAV_RECENT_TABLE_LIMIT).toBe(3);
    expect(pickRecentNavTables(entries).map((e) => e.tableId)).toEqual(['d', 'c', 'b']);
  });

  it('ranks personal access above updatedAt and pins the current table', () => {
    const picked = pickRecentNavTables(entries, {
      accessByTableId: { a: 100, b: 90 },
      currentTableId: 'c',
    });
    expect(picked.map((e) => e.tableId)).toEqual(['c', 'a', 'b']);
  });
});

describe('shouldShowNavMoreTables', () => {
  it('is true only when the user has more tables than the nav limit', () => {
    expect(shouldShowNavMoreTables(3)).toBe(false);
    expect(shouldShowNavMoreTables(4)).toBe(true);
  });
});

describe('table nav access map', () => {
  it('parses numeric stamps and caps oldest entries', () => {
    expect(tableNavAccessStorageKey('u1')).toBe('dh_table_nav_access_v1:u1');
    expect(parseTableNavAccessMap({ a: 5, b: 'nope' })).toEqual({ a: 5 });
    const seeded = {};
    for (let i = 0; i < TABLE_NAV_ACCESS_MAX_ENTRIES; i += 1) {
      seeded[`id-${i}`] = i;
    }
    const next = stampTableNavAccess(seeded, 'fresh', 10_000);
    expect(Object.keys(next)).toHaveLength(TABLE_NAV_ACCESS_MAX_ENTRIES);
    expect(next.fresh).toBe(10_000);
    expect(next['id-0']).toBeUndefined();
  });
});

describe('More nav button', () => {
  it('never uses active highlighting', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(dir, '../../src/client/app.jsx'), 'utf8');
    const idx = src.indexOf('label="More"');
    expect(idx).toBeGreaterThan(-1);
    expect(src.slice(idx, idx + 80)).toMatch(/active=\{false\}/);
  });
});
