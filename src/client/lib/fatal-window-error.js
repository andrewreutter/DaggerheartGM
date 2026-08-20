/**
 * Cross-origin scripts (esm.sh React, CDN dice) report `event.message === 'Script error.'`
 * with no `event.error`. Treating that as a fatal unmount hides the table and the real stack.
 *
 * @param {Pick<ErrorEvent, 'error' | 'message' | 'target'> | null | undefined} event
 * @returns {boolean}
 */
export function isCrossOriginScriptErrorEvent(event) {
  if (!event || typeof event !== 'object') return false;
  if (event.error != null) return false;
  return event.message === 'Script error.';
}

/**
 * @param {unknown} reason
 * @returns {string}
 */
export function formatUnhandledRejectionReason(reason) {
  if (reason instanceof Error) return reason.message || String(reason);
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String(reason.message);
  }
  return String(reason);
}
