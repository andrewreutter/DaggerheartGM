/**
 * Admin Problem reports page — status tabs + selection helpers.
 * Keep in sync with `BUG_REPORT_STATUSES` in `src/db.js`.
 */

/** @type {readonly string[]} */
export const BUG_REPORT_STATUS_ORDER = Object.freeze([
  'triage',
  'bug',
  'feature',
  'completed',
  'shipped',
  'cancelled',
]);

/**
 * @param {string} currentStatus
 * @returns {string[]}
 */
export function otherBugReportStatuses(currentStatus) {
  return BUG_REPORT_STATUS_ORDER.filter(s => s !== currentStatus);
}

/**
 * @param {Iterable<number>} selectedIds
 * @param {number[]} visibleIds
 * @returns {{ selectedCount: number, allSelected: boolean, someSelected: boolean }}
 */
export function bugReportSelectionState(selectedIds, visibleIds) {
  const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
  const selectedCount = visibleIds.reduce((n, id) => (selected.has(id) ? n + 1 : n), 0);
  const allSelected = visibleIds.length > 0 && selectedCount === visibleIds.length;
  const someSelected = selectedCount > 0 && selectedCount < visibleIds.length;
  return { selectedCount, allSelected, someSelected };
}

/**
 * Toggle one id in a selection set (immutable).
 * @param {Iterable<number>} selectedIds
 * @param {number} id
 * @returns {Set<number>}
 */
export function toggleBugReportSelection(selectedIds, id) {
  const next = new Set(selectedIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/**
 * Select-all / clear-all for the currently visible row ids.
 * @param {Iterable<number>} selectedIds
 * @param {number[]} visibleIds
 * @param {boolean} selectAll
 * @returns {Set<number>}
 */
export function setBugReportVisibleSelection(selectedIds, visibleIds, selectAll) {
  const next = new Set(selectedIds);
  if (selectAll) {
    for (const id of visibleIds) next.add(id);
  } else {
    for (const id of visibleIds) next.delete(id);
  }
  return next;
}
