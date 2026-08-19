/**
 * Pure helpers for the post-deploy "new version available" banner.
 * A missing id on either side is a no-op so old servers / failed fetches
 * never flash a false-positive Reload prompt.
 */

export const APP_BUILD_CHECK_EVENT = 'dh-app-build-check';
export const DISMISSED_BUILD_ID_STORAGE_KEY = 'dh_dismissed_app_build_id';

/**
 * @param {unknown} currentBuildId  — id the tab booted with
 * @param {unknown} serverBuildId   — id from a later GET /api/config
 * @returns {boolean}
 */
export function isAppBuildStale(currentBuildId, serverBuildId) {
  if (typeof currentBuildId !== 'string' || !currentBuildId) return false;
  if (typeof serverBuildId !== 'string' || !serverBuildId) return false;
  return currentBuildId !== serverBuildId;
}

/**
 * @param {{ currentBuildId?: unknown, serverBuildId?: unknown, dismissedBuildId?: unknown }} opts
 * @returns {boolean}
 */
export function shouldShowNewVersionBanner({ currentBuildId, serverBuildId, dismissedBuildId } = {}) {
  if (!isAppBuildStale(currentBuildId, serverBuildId)) return false;
  return dismissedBuildId !== serverBuildId;
}

/** Fire a window event so `useAppBuildCheck` re-fetches `/api/config`. */
export function notifyAppBuildCheck() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(APP_BUILD_CHECK_EVENT));
}

/**
 * Hook an EventSource so a Railway deploy (SSE drop + reconnect) re-checks
 * the process build id.
 *
 * @param {EventSource|null|undefined} es
 */
export function attachSseAppBuildCheck(es) {
  if (!es || typeof es.addEventListener !== 'function') return;
  es.addEventListener('open', notifyAppBuildCheck);
}
