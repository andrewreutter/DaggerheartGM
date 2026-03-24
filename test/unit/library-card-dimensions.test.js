import { describe, it, expect, beforeEach } from 'vitest';
import {
  libraryCardDimensionStorageKey,
  readStoredLibraryCardWidth,
  readStoredLibraryCardHeight,
  DEFAULT_LIBRARY_CARD_WIDTH,
  DEFAULT_LIBRARY_CARD_HEIGHT,
  MIN_LIBRARY_CARD_HEIGHT,
} from '../../src/client/lib/library-card-dimensions.js';

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

  it('returns defaults when nothing stored', () => {
    expect(readStoredLibraryCardWidth('u1', 'domains')).toBe(DEFAULT_LIBRARY_CARD_WIDTH);
    expect(readStoredLibraryCardHeight('u1', 'domains')).toBe(DEFAULT_LIBRARY_CARD_HEIGHT);
  });

  it('clamps stored height below minimum up to title-bar floor', () => {
    localStorage.setItem(libraryCardDimensionStorageKey('u1', 'weapons', 'Height'), '20');
    expect(readStoredLibraryCardHeight('u1', 'weapons')).toBe(MIN_LIBRARY_CARD_HEIGHT);
  });
});
