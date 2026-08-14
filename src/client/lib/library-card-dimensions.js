/**
 * Persist Library card width/height per Firebase user uid and collection (tab id).
 * DB source of truth: `user_preferences.data.libraryCardDimensions` (via GET/PUT /api/me/preferences).
 * localStorage remains a write-through cache (and anonymous / pre-hydration fallback).
 * Legacy keys `dh_libraryCardWidth` / `dh_libraryCardHeight` are read when scoped values are absent.
 */

/**
 * Per-tab card size defaults (used before the user has saved their own prefs for that tab).
 * Unknown tabs fall back to {@link DEFAULT_LIBRARY_CARD_WIDTH} / {@link DEFAULT_LIBRARY_CARD_HEIGHT}.
 */
export const DEFAULT_LIBRARY_CARD_DIMENSIONS = Object.freeze({
  all: Object.freeze({ width: 392, height: 359 }),
  abilities: Object.freeze({ width: 392, height: 150 }),
  adversaries: Object.freeze({ width: 392, height: 334 }),
  ancestries: Object.freeze({ width: 526, height: 239 }),
  armor: Object.freeze({ width: 392, height: 226 }),
  beastforms: Object.freeze({ width: 312, height: 251 }),
  campaign_frames: Object.freeze({ width: 526, height: 486 }),
  classes: Object.freeze({ width: 526, height: 324 }),
  communities: Object.freeze({ width: 526, height: 252 }),
  consumables: Object.freeze({ width: 221, height: 100 }),
  domains: Object.freeze({ width: 526, height: 279 }),
  environments: Object.freeze({ width: 259, height: 270 }),
  features: Object.freeze({ width: 221, height: 137 }),
  items: Object.freeze({ width: 221, height: 120 }),
  rules: Object.freeze({ width: 526, height: 161 }),
  scenes: Object.freeze({ width: 221, height: 315 }),
  subclasses: Object.freeze({ width: 392, height: 179 }),
  weapons: Object.freeze({ width: 392, height: 226 }),
});

/** Fallback when a tab has no entry in {@link DEFAULT_LIBRARY_CARD_DIMENSIONS}. */
export const DEFAULT_LIBRARY_CARD_WIDTH = 360;
export const MIN_LIBRARY_CARD_WIDTH = 220;
/** Stored widths are clamped on load to current viewport; no fixed upper bound. */
export const STORED_LIBRARY_CARD_WIDTH_CAP = 10000;
/** Fallback when a tab has no entry in {@link DEFAULT_LIBRARY_CARD_DIMENSIONS}. */
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

/** Default width/height for a library tab (per-type map, else global fallbacks). */
export function defaultLibraryCardDimensionsForTab(tab) {
  const d = tab && typeof tab === 'string' ? DEFAULT_LIBRARY_CARD_DIMENSIONS[tab] : null;
  if (d && typeof d.width === 'number' && typeof d.height === 'number') {
    return { width: d.width, height: d.height };
  }
  return { width: DEFAULT_LIBRARY_CARD_WIDTH, height: DEFAULT_LIBRARY_CARD_HEIGHT };
}

const LEGACY_LIBRARY_CARD_WIDTH_KEY = 'dh_libraryCardWidth';
const LEGACY_LIBRARY_CARD_HEIGHT_KEY = 'dh_libraryCardHeight';

export function libraryCardDimensionStorageKey(userUid, collection, dimension) {
  const uid = userUid && typeof userUid === 'string' ? userUid : '_';
  return `dh_libraryCard${dimension}_v2:${uid}:${collection}`;
}

export function clampStoredLibraryCardWidth(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(MIN_LIBRARY_CARD_WIDTH, Math.min(n, STORED_LIBRARY_CARD_WIDTH_CAP));
}

export function clampStoredLibraryCardHeight(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(MIN_LIBRARY_CARD_HEIGHT, Math.min(n, STORED_LIBRARY_CARD_HEIGHT_CAP));
}

/**
 * Normalize a preferences `libraryCardDimensions` map to `{ [tab]: { width, height } }`.
 * Invalid tabs/values are dropped; partial rows fill missing axis with per-tab defaults.
 */
export function normalizeLibraryCardDimensions(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [tab, dims] of Object.entries(raw)) {
    if (!tab || typeof tab !== 'string' || !dims || typeof dims !== 'object' || Array.isArray(dims)) continue;
    const width = clampStoredLibraryCardWidth(dims.width);
    const height = clampStoredLibraryCardHeight(dims.height);
    if (width == null && height == null) continue;
    const defaults = defaultLibraryCardDimensionsForTab(tab);
    out[tab] = {
      width: width ?? defaults.width,
      height: height ?? defaults.height,
    };
  }
  return out;
}

/** Clamp only the axes present on a single tab patch (no default fill). */
function normalizePartialTabDimensions(dims) {
  if (!dims || typeof dims !== 'object' || Array.isArray(dims)) return null;
  const width = Object.prototype.hasOwnProperty.call(dims, 'width')
    ? clampStoredLibraryCardWidth(dims.width)
    : null;
  const height = Object.prototype.hasOwnProperty.call(dims, 'height')
    ? clampStoredLibraryCardHeight(dims.height)
    : null;
  // hasOwn width/height that failed clamp → ignore that axis
  const out = {};
  if (Object.prototype.hasOwnProperty.call(dims, 'width') && width != null) out.width = width;
  if (Object.prototype.hasOwnProperty.call(dims, 'height') && height != null) out.height = height;
  return Object.keys(out).length ? out : null;
}

/** Deep-merge tab dimension patches onto a base map (partial patches keep the other axis). */
export function mergeLibraryCardDimensions(base, patch) {
  const out = { ...normalizeLibraryCardDimensions(base) };
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return out;
  for (const [tab, dims] of Object.entries(patch)) {
    if (!tab || typeof tab !== 'string') continue;
    const partial = normalizePartialTabDimensions(dims);
    if (!partial) continue;
    const defaults = defaultLibraryCardDimensionsForTab(tab);
    out[tab] = {
      width: defaults.width,
      height: defaults.height,
      ...(out[tab] || {}),
      ...partial,
    };
  }
  return out;
}

export function isLibraryCardDimensionsEmpty(map) {
  return !map || typeof map !== 'object' || Object.keys(map).length === 0;
}

/**
 * Resolve width/height for a tab: prefer DB map, else localStorage (scoped then legacy), else per-tab defaults.
 */
export function getDimensionsForTab(map, tab, userUid) {
  const defaults = defaultLibraryCardDimensionsForTab(tab);
  const fromMap = map && typeof map === 'object' ? map[tab] : null;
  if (
    fromMap &&
    typeof fromMap === 'object' &&
    typeof fromMap.width === 'number' &&
    typeof fromMap.height === 'number'
  ) {
    const width = clampStoredLibraryCardWidth(fromMap.width) ?? defaults.width;
    const height = clampStoredLibraryCardHeight(fromMap.height) ?? defaults.height;
    return { width, height };
  }
  return {
    width: readStoredLibraryCardWidth(userUid, tab),
    height: readStoredLibraryCardHeight(userUid, tab),
  };
}

export function writeStoredLibraryCardDimensions(userUid, collection, { width, height } = {}) {
  try {
    if (width != null && Number.isFinite(Number(width))) {
      localStorage.setItem(libraryCardDimensionStorageKey(userUid, collection, 'Width'), String(Math.round(Number(width))));
    }
    if (height != null && Number.isFinite(Number(height))) {
      localStorage.setItem(libraryCardDimensionStorageKey(userUid, collection, 'Height'), String(Math.round(Number(height))));
    }
  } catch { /* ignore */ }
}

/**
 * Scan localStorage for all scoped width/height keys for this uid (one-shot DB migrate).
 * Does not invent tabs from legacy unscoped keys alone.
 */
export function readAllStoredLibraryCardDimensions(userUid) {
  const uid = userUid && typeof userUid === 'string' ? userUid : '_';
  const widthPrefix = `dh_libraryCardWidth_v2:${uid}:`;
  const heightPrefix = `dh_libraryCardHeight_v2:${uid}:`;
  const out = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith(widthPrefix)) {
        const tab = key.slice(widthPrefix.length);
        if (!tab) continue;
        const w = clampStoredLibraryCardWidth(localStorage.getItem(key));
        if (w == null) continue;
        out[tab] = { ...(out[tab] || {}), width: w };
      } else if (key.startsWith(heightPrefix)) {
        const tab = key.slice(heightPrefix.length);
        if (!tab) continue;
        const h = clampStoredLibraryCardHeight(localStorage.getItem(key));
        if (h == null) continue;
        out[tab] = { ...(out[tab] || {}), height: h };
      }
    }
  } catch { /* ignore */ }
  return normalizeLibraryCardDimensions(out);
}

export function readStoredLibraryCardWidth(userUid, collection) {
  try {
    const scoped = localStorage.getItem(libraryCardDimensionStorageKey(userUid, collection, 'Width'));
    if (scoped != null) {
      const v = clampStoredLibraryCardWidth(scoped);
      if (v != null) return v;
    }
    const legacy = localStorage.getItem(LEGACY_LIBRARY_CARD_WIDTH_KEY);
    if (legacy != null) {
      const v = clampStoredLibraryCardWidth(legacy);
      if (v != null) return v;
    }
  } catch { /* ignore */ }
  return defaultLibraryCardDimensionsForTab(collection).width;
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
  return defaultLibraryCardDimensionsForTab(collection).height;
}
