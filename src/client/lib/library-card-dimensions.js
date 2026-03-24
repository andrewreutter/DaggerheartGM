/**
 * Persist Library card width/height per Firebase user uid and collection (tab id).
 * Legacy keys `dh_libraryCardWidth` / `dh_libraryCardHeight` are read as fallback when scoped values are absent.
 */

export const DEFAULT_LIBRARY_CARD_WIDTH = 360;
export const MIN_LIBRARY_CARD_WIDTH = 220;
/** Stored widths are clamped on load to current viewport; no fixed upper bound. */
export const STORED_LIBRARY_CARD_WIDTH_CAP = 10000;
export const DEFAULT_LIBRARY_CARD_HEIGHT = 176;
/**
 * Shortest library card: compact title row + padding (preview hidden at or below this; see ItemCard).
 */
export const MIN_LIBRARY_CARD_HEIGHT = 48;
/** Render the detail preview only when card height is above this (px). */
export const LIBRARY_CARD_PREVIEW_VISIBLE_MIN_HEIGHT = 72;
/** Stored heights: upper bound for localStorage validation only; runtime max follows scroll viewport. */
export const STORED_LIBRARY_CARD_HEIGHT_CAP = 10000;

/** Fixed CSS `zoom` on embedded `LibraryItemDisplayContent` in grid cards (modal-sized layout shrunk to fit). */
export const LIBRARY_CARD_DETAIL_ZOOM = 0.38;

const LEGACY_LIBRARY_CARD_WIDTH_KEY = 'dh_libraryCardWidth';
const LEGACY_LIBRARY_CARD_HEIGHT_KEY = 'dh_libraryCardHeight';

export function libraryCardDimensionStorageKey(userUid, collection, dimension) {
  const uid = userUid && typeof userUid === 'string' ? userUid : '_';
  return `dh_libraryCard${dimension}_v2:${uid}:${collection}`;
}

export function readStoredLibraryCardWidth(userUid, collection) {
  try {
    const scoped = localStorage.getItem(libraryCardDimensionStorageKey(userUid, collection, 'Width'));
    if (scoped != null) {
      const v = Number(scoped);
      if (Number.isFinite(v) && v >= MIN_LIBRARY_CARD_WIDTH && v <= STORED_LIBRARY_CARD_WIDTH_CAP) return v;
    }
    const legacy = localStorage.getItem(LEGACY_LIBRARY_CARD_WIDTH_KEY);
    if (legacy != null) {
      const v = Number(legacy);
      if (Number.isFinite(v) && v >= MIN_LIBRARY_CARD_WIDTH && v <= STORED_LIBRARY_CARD_WIDTH_CAP) return v;
    }
  } catch { /* ignore */ }
  return DEFAULT_LIBRARY_CARD_WIDTH;
}

function clampStoredLibraryCardHeight(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(MIN_LIBRARY_CARD_HEIGHT, Math.min(n, STORED_LIBRARY_CARD_HEIGHT_CAP));
}

export function readStoredLibraryCardHeight(userUid, collection) {
  try {
    const scoped = localStorage.getItem(libraryCardDimensionStorageKey(userUid, collection, 'Height'));
    if (scoped != null) {
      const c = clampStoredLibraryCardHeight(scoped);
      if (c != null) return c;
    }
    const legacy = localStorage.getItem(LEGACY_LIBRARY_CARD_HEIGHT_KEY);
    if (legacy != null) {
      const c = clampStoredLibraryCardHeight(legacy);
      if (c != null) return c;
    }
  } catch { /* ignore */ }
  return DEFAULT_LIBRARY_CARD_HEIGHT;
}

