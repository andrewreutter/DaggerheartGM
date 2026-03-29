import { getLibraryFilterConfig } from './library-filter-config.js';

/**
 * Minimal defaults for a new row in an SRD-backed library tab (used by ItemDetailModal).
 * Does not cover adversaries/characters — those use dedicated defaults in the modal.
 *
 * @param {string} collection
 * @returns {Record<string, unknown>}
 */
export function buildDefaultNewSrdLibraryItem(collection) {
  const cfg = getLibraryFilterConfig(collection);
  const out = { name: '', description: '' };
  if (cfg.rankMode === 'tier') out.tier = 1;
  if (cfg.rankMode === 'level') out.level = 1;
  if (collection === 'environments') {
    out.type = 'exploration';
    out.difficulty = 10;
  }
  return out;
}
