import { describe, it, expect } from 'vitest';
import { parseRoute, legacyGmTableToCanonical, DEFAULT_LIBRARY_TAB } from '../../src/client/lib/router.js';

describe('parseRoute /library', () => {
  it('defaults tab to characters when path is /library or tab segment is invalid', () => {
    expect(parseRoute('/library').tab).toBe(DEFAULT_LIBRARY_TAB);
    expect(parseRoute('/library/').tab).toBe(DEFAULT_LIBRARY_TAB);
    expect(parseRoute('/library/not-a-real-tab').tab).toBe(DEFAULT_LIBRARY_TAB);
  });
});

describe('parseRoute /table', () => {
  const gmUid = '9s3M6tgScJgXhKgYOHZVYAStNQi2';
  const secondaryTableId = 'd6f893df-6a9a-44da-b722-7d4de2c35e97';
  const charId = '5c098068-7751-416c-8a5f-24ca3494574b';

  it('parses secondary table + character modal', () => {
    const r = parseRoute(`/table/${secondaryTableId}/characters/${charId}`);
    expect(r.view).toBe('table');
    expect(r.tableId).toBe(secondaryTableId);
    expect(r.modalCollection).toBe('characters');
    expect(r.modalItemId).toBe(charId);
  });

  it('parses primary table character modal', () => {
    const r = parseRoute(`/table/${gmUid}/characters/${charId}`);
    expect(r.view).toBe('table');
    expect(r.tableId).toBe(gmUid);
    expect(r.modalCollection).toBe('characters');
    expect(r.modalItemId).toBe(charId);
  });

  it('parses legacy /gm-table paths the same tableId as /table', () => {
    const legacy = parseRoute(`/gm-table/${gmUid}/${secondaryTableId}/characters/${charId}`);
    const modern = parseRoute(`/table/${secondaryTableId}/characters/${charId}`);
    expect(legacy.tableId).toBe(modern.tableId);
    expect(legacy.modalCollection).toBe(modern.modalCollection);
    expect(legacy.view).toBe('table');
  });
});

describe('legacyGmTableToCanonical', () => {
  const uid = '9s3M6tgScJgXhKgYOHZVYAStNQi2';
  const tid = 'd6f893df-6a9a-44da-b722-7d4de2c35e97';
  const charId = '5c098068-7751-416c-8a5f-24ca3494574b';

  it('maps legacy paths without user uid when unambiguous', () => {
    expect(legacyGmTableToCanonical(`/gm-table/${uid}`, null)).toBe(`/table/${uid}`);
    expect(legacyGmTableToCanonical(`/gm-table/${uid}/${tid}/characters/${charId}`, null)).toBe(`/table/${tid}/characters/${charId}`);
  });

  it('needs user uid for bare /gm-table and /gm-table/:collection/:id', () => {
    expect(legacyGmTableToCanonical('/gm-table', null)).toBe(null);
    expect(legacyGmTableToCanonical('/gm-table', uid)).toBe(`/table/${uid}`);
    expect(legacyGmTableToCanonical('/gm-table/characters/abc', null)).toBe(null);
    expect(legacyGmTableToCanonical('/gm-table/characters/abc', uid)).toBe(`/table/${uid}/characters/abc`);
  });

  it('returns null for non-legacy paths', () => {
    expect(legacyGmTableToCanonical('/table/x', uid)).toBe(null);
    expect(legacyGmTableToCanonical('/library/adversaries', uid)).toBe(null);
  });
});
