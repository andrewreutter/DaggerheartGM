import { describe, it, expect } from 'vitest';
import { shouldFetchTableState, tableAccessErrorAfterFetch } from '../../src/client/lib/table-state-load.js';

describe('shouldFetchTableState', () => {
  it('waits until auth has settled so a private owned table is not fetched anonymously', () => {
    expect(shouldFetchTableState({ view: 'table', tableId: 'abc', authSettled: false })).toBe(false);
    expect(shouldFetchTableState({ view: 'table', tableId: 'abc', authSettled: true })).toBe(true);
    expect(shouldFetchTableState({ view: 'home', tableId: 'abc', authSettled: true })).toBe(false);
    expect(shouldFetchTableState({ view: 'table', tableId: null, authSettled: true })).toBe(false);
  });
});

describe('tableAccessErrorAfterFetch', () => {
  it('clears a sticky private/not-found gate on success', () => {
    expect(tableAccessErrorAfterFetch({ ok: true })).toBe(null);
  });

  it('maps 403/404 to the table access screens', () => {
    expect(tableAccessErrorAfterFetch({ ok: false, httpStatus: 403 })).toBe('private');
    expect(tableAccessErrorAfterFetch({ ok: false, httpStatus: 404 })).toBe('not-found');
  });

  it('leaves the previous error unchanged on other failures', () => {
    expect(tableAccessErrorAfterFetch({ ok: false, httpStatus: 500 })).toBe(undefined);
  });
});
