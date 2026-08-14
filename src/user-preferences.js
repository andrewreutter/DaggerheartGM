/**
 * Pure helpers for `user_preferences.data` JSON shape.
 * Used by db.js / server routes and unit tests.
 */

import {
  mergeLibraryCardDimensions,
  normalizeLibraryCardDimensions,
} from './client/lib/library-card-dimensions.js';

/** Normalize a stored or API preferences object. */
export function normalizeUserPreferences(data) {
  const d = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  return {
    hideAiUi: !!d.hideAiUi,
    libraryCardDimensions: normalizeLibraryCardDimensions(d.libraryCardDimensions),
  };
}

/**
 * Merge a preferences patch onto existing prefs.
 * - `hideAiUi` updates only when the patch includes a boolean.
 * - `libraryCardDimensions` deep-merges per library tab.
 */
export function mergeUserPreferencesData(existing, patch) {
  const base = normalizeUserPreferences(existing);
  const p = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {};
  return {
    hideAiUi: typeof p.hideAiUi === 'boolean' ? p.hideAiUi : base.hideAiUi,
    libraryCardDimensions: Object.prototype.hasOwnProperty.call(p, 'libraryCardDimensions')
      ? mergeLibraryCardDimensions(base.libraryCardDimensions, p.libraryCardDimensions)
      : base.libraryCardDimensions,
  };
}
