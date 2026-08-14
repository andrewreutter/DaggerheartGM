import { describe, it, expect, beforeEach } from 'vitest';
import {
  libraryCardDimensionStorageKey,
  readStoredLibraryCardWidth,
  readStoredLibraryCardHeight,
  readAllStoredLibraryCardDimensions,
  normalizeLibraryCardDimensions,
  mergeLibraryCardDimensions,
  getDimensionsForTab,
  isLibraryCardDimensionsEmpty,
  defaultLibraryCardDimensionsForTab,
  DEFAULT_LIBRARY_CARD_DIMENSIONS,
  DEFAULT_LIBRARY_CARD_WIDTH,
  DEFAULT_LIBRARY_CARD_HEIGHT,
  MIN_LIBRARY_CARD_HEIGHT,
  MIN_LIBRARY_CARD_WIDTH,
} from '../../src/client/lib/library-card-dimensions.js';
import {
  mergeUserPreferencesData,
  normalizeUserPreferences,
} from '../../src/user-preferences.js';

describe('library-card-dimensions', () => {
  const store = new Map();

  beforeEach(() => {
    store.clear();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => {
        store.set(k, String(v));
      },
      removeItem: (k) => {
        store.delete(k);
      },
      clear: () => {
        store.clear();
      },
      key: (i) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    };
  });

  it('scopes storage key by uid and collection', () => {
    expect(libraryCardDimensionStorageKey('u1', 'weapons', 'Width')).toBe('dh_libraryCardWidth_v2:u1:weapons');
    expect(libraryCardDimensionStorageKey('u1', 'weapons', 'Height')).toBe('dh_libraryCardHeight_v2:u1:weapons');
  });

  it('uses underscore uid when user id is missing', () => {
    expect(libraryCardDimensionStorageKey(undefined, 'armor', 'Width')).toBe('dh_libraryCardWidth_v2:_:armor');
  });

  it('reads scoped width when present', () => {
    localStorage.setItem(libraryCardDimensionStorageKey('u1', 'adversaries', 'Width'), '400');
    expect(readStoredLibraryCardWidth('u1', 'adversaries')).toBe(400);
  });

  it('falls back to legacy global width when scoped missing', () => {
    localStorage.setItem('dh_libraryCardWidth', '333');
    expect(readStoredLibraryCardWidth('u1', 'weapons')).toBe(333);
  });

  it('reads scoped height when present', () => {
    localStorage.setItem(libraryCardDimensionStorageKey('u1', 'adversaries', 'Height'), '200');
    expect(readStoredLibraryCardHeight('u1', 'adversaries')).toBe(200);
  });

  it('falls back to legacy global height when scoped missing', () => {
    localStorage.setItem('dh_libraryCardHeight', '240');
    expect(readStoredLibraryCardHeight('u1', 'weapons')).toBe(240);
  });

  it('returns per-tab defaults when nothing stored', () => {
    expect(readStoredLibraryCardWidth('u1', 'domains')).toBe(DEFAULT_LIBRARY_CARD_DIMENSIONS.domains.width);
    expect(readStoredLibraryCardHeight('u1', 'domains')).toBe(DEFAULT_LIBRARY_CARD_DIMENSIONS.domains.height);
    expect(readStoredLibraryCardWidth('u1', 'adventures')).toBe(DEFAULT_LIBRARY_CARD_WIDTH);
    expect(readStoredLibraryCardHeight('u1', 'adventures')).toBe(DEFAULT_LIBRARY_CARD_HEIGHT);
  });

  it('defaultLibraryCardDimensionsForTab uses per-type map', () => {
    expect(defaultLibraryCardDimensionsForTab('classes')).toEqual(DEFAULT_LIBRARY_CARD_DIMENSIONS.classes);
    expect(defaultLibraryCardDimensionsForTab('unknown-tab')).toEqual({
      width: DEFAULT_LIBRARY_CARD_WIDTH,
      height: DEFAULT_LIBRARY_CARD_HEIGHT,
    });
  });

  it('clamps stored height below minimum up to title-bar floor', () => {
    localStorage.setItem(libraryCardDimensionStorageKey('u1', 'weapons', 'Height'), '20');
    expect(readStoredLibraryCardHeight('u1', 'weapons')).toBe(MIN_LIBRARY_CARD_HEIGHT);
  });

  it('min height still fits compact title row: 32px thumb + ItemCard vertical padding (see ItemCard + LibraryItemImageThumb compact)', () => {
    const compactThumbPx = 32;
    const itemCardBodyVerticalPaddingPx = 10; // pt-1.5 + pb-1
    expect(compactThumbPx + itemCardBodyVerticalPaddingPx).toBeLessThanOrEqual(MIN_LIBRARY_CARD_HEIGHT);
  });

  it('normalizes and merges libraryCardDimensions maps', () => {
    expect(normalizeLibraryCardDimensions(null)).toEqual({});
    expect(normalizeLibraryCardDimensions({
      weapons: { width: 400, height: 20 },
      bad: null,
    })).toEqual({
      weapons: { width: 400, height: MIN_LIBRARY_CARD_HEIGHT },
    });
    expect(mergeLibraryCardDimensions(
      { weapons: { width: 400, height: 200 } },
      { weapons: { width: 300 }, armor: { width: 250, height: 100 } },
    )).toEqual({
      weapons: { width: 300, height: 200 },
      armor: { width: 250, height: 100 },
    });
  });

  it('fills missing axis from per-tab defaults when normalizing', () => {
    expect(normalizeLibraryCardDimensions({
      armor: { width: 300 },
    })).toEqual({
      armor: { width: 300, height: DEFAULT_LIBRARY_CARD_DIMENSIONS.armor.height },
    });
  });

  it('getDimensionsForTab prefers map over localStorage', () => {
    localStorage.setItem(libraryCardDimensionStorageKey('u1', 'weapons', 'Width'), '400');
    localStorage.setItem(libraryCardDimensionStorageKey('u1', 'weapons', 'Height'), '200');
    expect(getDimensionsForTab(
      { weapons: { width: 320, height: 120 } },
      'weapons',
      'u1',
    )).toEqual({ width: 320, height: 120 });
    expect(getDimensionsForTab({}, 'weapons', 'u1')).toEqual({ width: 400, height: 200 });
  });

  it('getDimensionsForTab uses per-tab defaults when map and storage empty', () => {
    expect(getDimensionsForTab({}, 'adversaries', 'u1')).toEqual(DEFAULT_LIBRARY_CARD_DIMENSIONS.adversaries);
  });

  it('readAllStoredLibraryCardDimensions scans scoped keys for a uid', () => {
    localStorage.setItem(libraryCardDimensionStorageKey('u1', 'weapons', 'Width'), '400');
    localStorage.setItem(libraryCardDimensionStorageKey('u1', 'weapons', 'Height'), '200');
    localStorage.setItem(libraryCardDimensionStorageKey('u1', 'armor', 'Width'), '300');
    localStorage.setItem(libraryCardDimensionStorageKey('u2', 'weapons', 'Width'), '500');
    expect(readAllStoredLibraryCardDimensions('u1')).toEqual({
      weapons: { width: 400, height: 200 },
      armor: { width: 300, height: DEFAULT_LIBRARY_CARD_DIMENSIONS.armor.height },
    });
    expect(isLibraryCardDimensionsEmpty({})).toBe(true);
    expect(isLibraryCardDimensionsEmpty(readAllStoredLibraryCardDimensions('u1'))).toBe(false);
  });

  it('clamps width below minimum', () => {
    expect(normalizeLibraryCardDimensions({
      x: { width: 10, height: 100 },
    }).x.width).toBe(MIN_LIBRARY_CARD_WIDTH);
  });
});

describe('user-preferences merge', () => {
  it('normalizes defaults', () => {
    expect(normalizeUserPreferences(null)).toEqual({
      hideAiUi: false,
      libraryCardDimensions: {},
    });
  });

  it('deep-merges libraryCardDimensions without dropping other tabs', () => {
    const merged = mergeUserPreferencesData(
      {
        hideAiUi: true,
        libraryCardDimensions: { weapons: { width: 400, height: 176 } },
      },
      { libraryCardDimensions: { armor: { width: 300, height: 120 } } },
    );
    expect(merged).toEqual({
      hideAiUi: true,
      libraryCardDimensions: {
        weapons: { width: 400, height: 176 },
        armor: { width: 300, height: 120 },
      },
    });
  });

  it('updates hideAiUi without clearing dimensions', () => {
    const merged = mergeUserPreferencesData(
      {
        hideAiUi: false,
        libraryCardDimensions: { weapons: { width: 400, height: 176 } },
      },
      { hideAiUi: true },
    );
    expect(merged.hideAiUi).toBe(true);
    expect(merged.libraryCardDimensions).toEqual({
      weapons: { width: 400, height: 176 },
    });
  });
});
