/**
 * Admin Problem reports page — status columns + selection helpers.
 * Default column ids stay in sync with `BUG_REPORT_STATUSES` in `src/db.js`.
 * Custom columns are `{ id, label }` rows; `id` is the persisted `bug_reports.status` slug.
 */

/** @type {readonly { id: string, label: string }[]} */
export const DEFAULT_BUG_REPORT_COLUMNS = Object.freeze([
  { id: 'triage', label: 'Triage' },
  { id: 'bug', label: 'Bug' },
  { id: 'feature', label: 'Feature' },
  { id: 'completed', label: 'Completed' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'cancelled', label: 'Cancelled' },
]);

/** @type {readonly string[]} */
export const BUG_REPORT_STATUS_ORDER = Object.freeze(
  DEFAULT_BUG_REPORT_COLUMNS.map(c => c.id)
);

export const BUG_REPORT_STATUS_SLUG_RE = /^[a-z][a-z0-9_-]{0,31}$/;
export const BUG_REPORT_COLUMN_LABEL_MAX = 32;
export const BUG_REPORT_COLUMNS_MAX = 20;
export const BUG_REPORT_COLUMNS_STORAGE_KEY = 'dh_bugReportColumns_v1';
export const BUG_REPORT_TAB_STORAGE_KEY = 'dh_bugReportTab_v1';

/**
 * @param {unknown} status
 * @returns {status is string}
 */
export function isValidBugReportStatus(status) {
  return typeof status === 'string' && BUG_REPORT_STATUS_SLUG_RE.test(status);
}

/**
 * @param {unknown} label
 * @returns {string|null}
 */
export function slugifyBugReportColumnId(label) {
  if (typeof label !== 'string') return null;
  let slug = label
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  if (!slug) return null;
  if (!/^[a-z]/.test(slug)) {
    slug = `col-${slug}`.slice(0, 32);
  }
  return isValidBugReportStatus(slug) ? slug : null;
}

function cloneDefaultColumns() {
  return DEFAULT_BUG_REPORT_COLUMNS.map(c => ({ id: c.id, label: c.label }));
}

/**
 * @param {unknown} raw
 * @returns {{ id: string, label: string }[]}
 */
export function normalizeBugReportColumns(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return cloneDefaultColumns();
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const id = typeof item.id === 'string' ? item.id : slugifyBugReportColumnId(item.label);
    if (!isValidBugReportStatus(id) || seen.has(id)) continue;
    const label = typeof item.label === 'string' ? item.label.trim().slice(0, BUG_REPORT_COLUMN_LABEL_MAX) : '';
    if (!label) continue;
    seen.add(id);
    out.push({ id, label });
    if (out.length >= BUG_REPORT_COLUMNS_MAX) break;
  }
  return out.length > 0 ? out : cloneDefaultColumns();
}

/**
 * @param {unknown} columns
 * @param {unknown} label
 * @returns {{ ok: true, columns: { id: string, label: string }[], column: { id: string, label: string } } | { ok: false, error: string, columns: { id: string, label: string }[] }}
 */
export function addBugReportColumn(columns, label) {
  const normalized = normalizeBugReportColumns(columns);
  const trimmed = typeof label === 'string' ? label.trim().slice(0, BUG_REPORT_COLUMN_LABEL_MAX) : '';
  if (!trimmed) {
    return { ok: false, error: 'Name is required', columns: normalized };
  }
  if (normalized.length >= BUG_REPORT_COLUMNS_MAX) {
    return { ok: false, error: 'Maximum columns reached', columns: normalized };
  }
  let id = slugifyBugReportColumnId(trimmed);
  if (!id) {
    return { ok: false, error: 'Name must include a letter', columns: normalized };
  }
  if (normalized.some(c => c.id === id)) {
    let n = 2;
    let candidate = `${id}-${n}`;
    while (normalized.some(c => c.id === candidate) && n < 99) {
      n += 1;
      candidate = `${id}-${n}`;
    }
    if (!isValidBugReportStatus(candidate) || normalized.some(c => c.id === candidate)) {
      return { ok: false, error: 'A column with that name already exists', columns: normalized };
    }
    id = candidate;
  }
  const column = { id, label: trimmed };
  return { ok: true, columns: [...normalized, column], column };
}

/**
 * @param {unknown} columns
 * @param {number} fromIndex
 * @param {number} toIndex
 * @returns {{ id: string, label: string }[]}
 */
export function reorderBugReportColumns(columns, fromIndex, toIndex) {
  const normalized = normalizeBugReportColumns(columns);
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= normalized.length ||
    toIndex >= normalized.length ||
    fromIndex === toIndex
  ) {
    return normalized;
  }
  const next = [...normalized];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/**
 * @param {string} currentStatus
 * @param {unknown} [columns]
 * @returns {string[]}
 */
export function otherBugReportStatuses(currentStatus, columns) {
  return normalizeBugReportColumns(columns).map(c => c.id).filter(s => s !== currentStatus);
}

/**
 * @returns {{ id: string, label: string }[] | null}
 */
export function readStoredBugReportColumns() {
  try {
    const raw = localStorage.getItem(BUG_REPORT_COLUMNS_STORAGE_KEY);
    if (!raw) return null;
    return normalizeBugReportColumns(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Validate a quick-add from the admin Problem reports page.
 * @param {unknown} body
 * @returns {{ ok: true, notes: string, status: string } | { ok: false, error: string }}
 */
export function normalizeManualBugReportCreate(body) {
  const notes = typeof body?.notes === 'string' ? body.notes.trim() : '';
  if (!notes) return { ok: false, error: 'notes are required' };
  if (!isValidBugReportStatus(body?.status)) {
    return { ok: false, error: 'status must be a valid column slug' };
  }
  return { ok: true, notes, status: body.status };
}

/** Persist the Problem reports column layout (local write-through cache). */
export function writeStoredBugReportColumns(columns) {
  try {
    localStorage.setItem(
      BUG_REPORT_COLUMNS_STORAGE_KEY,
      JSON.stringify(normalizeBugReportColumns(columns))
    );
  } catch {
    // quota / private mode
  }
}

/**
 * Pick a valid Problem reports tab: stored slug if it still exists, else the first column.
 * @param {unknown} storedTab
 * @param {unknown} [columns]
 * @returns {string}
 */
export function resolveBugReportTab(storedTab, columns) {
  const normalized = normalizeBugReportColumns(columns);
  if (typeof storedTab === 'string' && normalized.some(c => c.id === storedTab)) {
    return storedTab;
  }
  return normalized[0]?.id ?? 'triage';
}

/**
 * @param {unknown} [columns]
 * @returns {string}
 */
export function readStoredBugReportTab(columns) {
  try {
    return resolveBugReportTab(localStorage.getItem(BUG_REPORT_TAB_STORAGE_KEY), columns);
  } catch {
    return resolveBugReportTab(null, columns);
  }
}

/** Persist the last-selected Problem reports tab (survives reload). */
export function writeStoredBugReportTab(tab) {
  try {
    if (typeof tab === 'string' && isValidBugReportStatus(tab)) {
      localStorage.setItem(BUG_REPORT_TAB_STORAGE_KEY, tab);
    }
  } catch {
    // quota / private mode
  }
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
