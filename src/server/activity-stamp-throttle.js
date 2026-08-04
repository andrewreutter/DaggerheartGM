/**
 * Pure helpers for the lastPlayActivityAt throttle used by applyOpToTableState.
 * Extracted into this module so they can be unit-tested without importing server.js.
 */

export const ACTIVITY_STAMP_THROTTLE_MS = 60_000;

/**
 * Returns true if the lastPlayActivityAt stamp should be skipped because the
 * existing timestamp is already fresh (within the throttle window).
 *
 * Safe to call with undefined/null — returns false so the stamp always runs
 * on the first write or when the field has never been set.
 *
 * @param {number|undefined|null} lastPlayActivityAt — existing timestamp (ms since epoch)
 * @param {number} [nowMs] — current time (defaults to Date.now())
 * @param {number} [throttleMs] — staleness window (defaults to ACTIVITY_STAMP_THROTTLE_MS)
 * @returns {boolean}
 */
export function shouldSkipActivityStamp(lastPlayActivityAt, nowMs = Date.now(), throttleMs = ACTIVITY_STAMP_THROTTLE_MS) {
  return typeof lastPlayActivityAt === 'number' && (nowMs - lastPlayActivityAt) < throttleMs;
}
