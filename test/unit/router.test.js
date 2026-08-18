import { describe, it, expect } from 'vitest';
import { parseRoute, legacyGmTableToCanonical, DEFAULT_LIBRARY_TAB, shouldHandleSpaNavClick, canonicalizePathname, canonicalizeAppPath } from '../../src/client/lib/router.js';

describe('parseRoute /library', () => {
  it('defaults tab to All when path is /library or tab segment is invalid', () => {
    expect(parseRoute('/library').tab).toBe(DEFAULT_LIBRARY_TAB);
    expect(parseRoute('/library/').tab).toBe(DEFAULT_LIBRARY_TAB);
    expect(parseRoute('/library/not-a-real-tab').tab).toBe(DEFAULT_LIBRARY_TAB);
  });

  it('parses /library/all and optional item id', () => {
    expect(parseRoute('/library/all')).toEqual({
      view: 'library',
      tab: 'all',
      itemId: null,
      libraryNewCollection: null,
      librarySemantic: null,
      librarySearchQuery: null,
    });
    expect(parseRoute('/library/all/some-item-id')).toEqual({
      view: 'library',
      tab: 'all',
      itemId: 'some-item-id',
      libraryNewCollection: null,
      librarySemantic: null,
      librarySearchQuery: null,
    });
  });

  it('parses /library/all/new?c= for merged-tab new item type', () => {
    expect(parseRoute('/library/all/new')).toEqual({
      view: 'library',
      tab: 'all',
      itemId: 'new',
      libraryNewCollection: null,
      librarySemantic: null,
      librarySearchQuery: null,
    });
    expect(parseRoute('/library/all/new?c=adversaries')).toEqual({
      view: 'library',
      tab: 'all',
      itemId: 'new',
      libraryNewCollection: 'adversaries',
      librarySemantic: null,
      librarySearchQuery: null,
    });
  });

  it('parses /library/features and optional V2 feature id', () => {
    expect(parseRoute('/library/features')).toEqual({
      view: 'library',
      tab: 'features',
      itemId: null,
      libraryNewCollection: null,
      librarySemantic: null,
      librarySearchQuery: null,
    });
    expect(parseRoute('/library/features/v2feat-classes-srd-cls-bard-rally')).toEqual({
      view: 'library',
      tab: 'features',
      itemId: 'v2feat-classes-srd-cls-bard-rally',
      libraryNewCollection: null,
      librarySemantic: null,
      librarySearchQuery: null,
    });
  });

  it('parses assistant tab and library search query params', () => {
    expect(parseRoute('/library/assistant')).toEqual({
      view: 'library',
      tab: 'assistant',
      itemId: null,
      libraryNewCollection: null,
      librarySemantic: null,
      librarySearchQuery: null,
    });
    expect(parseRoute('/library/all?semantic=comes+from+the+trees&search=wither')).toEqual({
      view: 'library',
      tab: 'all',
      itemId: null,
      libraryNewCollection: null,
      librarySemantic: 'comes from the trees',
      librarySearchQuery: 'wither',
    });
  });
});

describe('parseRoute /', () => {
  it('parses bare home with null auth query params', () => {
    expect(parseRoute('/')).toEqual({
      view: 'home',
      tab: null,
      itemId: null,
      librarySemantic: null,
      librarySearchQuery: null,
      authMode: null,
      returnTo: null,
    });
  });

  it('reads authMode and returnTo query params', () => {
    expect(parseRoute('/?authMode=signin&returnTo=%2Flibrary%2Fall')).toEqual({
      view: 'home',
      tab: null,
      itemId: null,
      librarySemantic: null,
      librarySearchQuery: null,
      authMode: 'signin',
      returnTo: '/library/all',
    });
    expect(parseRoute('/?authMode=signup&returnTo=%2Ftable%2Fabc')).toMatchObject({
      view: 'home',
      authMode: 'signup',
      returnTo: '/table/abc',
    });
  });

  it('treats unknown authMode as null', () => {
    expect(parseRoute('/?authMode=forgot').authMode).toBe(null);
  });
});

describe('parseRoute /admin', () => {
  it('parses /admin/ai-usage', () => {
    expect(parseRoute('/admin/ai-usage')).toEqual({
      view: 'adminAiUsage',
      tab: null,
      itemId: null,
      librarySemantic: null,
      librarySearchQuery: null,
    });
  });
});

describe('parseRoute legal pages', () => {
  it('parses /terms, /privacy, /support, /cookies as simple public views', () => {
    expect(parseRoute('/terms')).toEqual({
      view: 'terms',
      tab: null,
      itemId: null,
      librarySemantic: null,
      librarySearchQuery: null,
    });
    expect(parseRoute('/privacy')).toEqual({
      view: 'privacy',
      tab: null,
      itemId: null,
      librarySemantic: null,
      librarySearchQuery: null,
    });
    expect(parseRoute('/support')).toEqual({
      view: 'support',
      tab: null,
      itemId: null,
      librarySemantic: null,
      librarySearchQuery: null,
    });
    expect(parseRoute('/cookies')).toEqual({
      view: 'cookies',
      tab: null,
      itemId: null,
      librarySemantic: null,
      librarySearchQuery: null,
    });
  });
});

describe('parseRoute /join', () => {
  it('parses /join/:token', () => {
    expect(parseRoute('/join/abc123')).toEqual({ view: 'join', token: 'abc123' });
  });
});

describe('canonicalizeAppPath', () => {
  it('strips trailing slashes except on /', () => {
    expect(canonicalizePathname('/')).toBe('/');
    expect(canonicalizePathname('/table/abc/')).toBe('/table/abc');
    expect(canonicalizePathname('/table/abc///')).toBe('/table/abc');
    expect(canonicalizeAppPath('/table/abc/?x=1')).toBe('/table/abc?x=1');
    expect(canonicalizeAppPath('/')).toBe('/');
  });
});

describe('parseRoute /table', () => {
  const gmUid = '9s3M6tgScJgXhKgYOHZVYAStNQi2';
  const secondaryTableId = 'd6f893df-6a9a-44da-b722-7d4de2c35e97';
  const charId = '5c098068-7751-416c-8a5f-24ca3494574b';

  it('treats a trailing slash as the same table id', () => {
    const withSlash = parseRoute(`/table/${secondaryTableId}/`);
    const without = parseRoute(`/table/${secondaryTableId}`);
    expect(withSlash).toEqual(without);
    expect(withSlash.tableId).toBe(secondaryTableId);
    expect(withSlash.view).toBe('table');
  });

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

describe('shouldHandleSpaNavClick', () => {
  const ev = (overrides = {}) => ({ metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, button: 0, ...overrides });

  it('returns true for a plain primary left-click', () => {
    expect(shouldHandleSpaNavClick(ev())).toBe(true);
  });

  it('returns false for Cmd-click (metaKey)', () => {
    expect(shouldHandleSpaNavClick(ev({ metaKey: true }))).toBe(false);
  });

  it('returns false for Ctrl-click (ctrlKey)', () => {
    expect(shouldHandleSpaNavClick(ev({ ctrlKey: true }))).toBe(false);
  });

  it('returns false for Shift-click', () => {
    expect(shouldHandleSpaNavClick(ev({ shiftKey: true }))).toBe(false);
  });

  it('returns false for Alt-click', () => {
    expect(shouldHandleSpaNavClick(ev({ altKey: true }))).toBe(false);
  });

  it('returns false for middle-click (button 1)', () => {
    expect(shouldHandleSpaNavClick(ev({ button: 1 }))).toBe(false);
  });

  it('returns false for right-click (button 2)', () => {
    expect(shouldHandleSpaNavClick(ev({ button: 2 }))).toBe(false);
  });
});
