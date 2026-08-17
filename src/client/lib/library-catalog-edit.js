import { LIBRARY_READONLY_SRD_COLLECTIONS, LIBRARY_USER_EDITABLE_COLLECTIONS } from './library-filter-config.js';

/** Cache-backed official catalog sources (SRD parser rows + DT starter scenes). */
export function isCatalogSource(item) {
  const source = typeof item === 'string' ? item : item?._source;
  return source === 'srd' || source === 'dt';
}

/**
 * Admin in-place edit of an official catalog row (writes `external_item_cache`, not a Mine clone).
 * Excludes V2 `features`, in-memory `campaign_frames` / `rules`, Public, and Mine.
 */
export function canEditLibraryCatalogItem(item, { isAdmin, collection } = {}) {
  if (!isAdmin) return false;
  if (!isCatalogSource(item)) return false;
  if (!collection || collection === 'features') return false;
  if (LIBRARY_READONLY_SRD_COLLECTIONS.has(collection)) return false;
  return LIBRARY_USER_EDITABLE_COLLECTIONS.has(collection);
}
