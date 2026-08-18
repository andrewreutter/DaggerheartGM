/**
 * Top-nav Game Table tabs: at most {@link NAV_RECENT_TABLE_LIMIT} recently
 * accessed tables (owned + invited), with a More → home affordance when the
 * user has additional tables on My Tables.
 */

export const NAV_RECENT_TABLE_LIMIT = 3;
export const TABLE_NAV_ACCESS_STORAGE_PREFIX = 'dh_table_nav_access_v1:';
export const TABLE_NAV_ACCESS_MAX_ENTRIES = 40;

export function tableNavAccessStorageKey(uid) {
  return `${TABLE_NAV_ACCESS_STORAGE_PREFIX}${uid || 'anon'}`;
}

export function parseTableNavAccessMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [id, at] of Object.entries(raw)) {
    if (!id || typeof id !== 'string') continue;
    const n = typeof at === 'number' ? at : Date.parse(at);
    if (Number.isFinite(n)) out[id] = n;
  }
  return out;
}

export function stampTableNavAccess(map, tableId, at = Date.now()) {
  if (!tableId || typeof tableId !== 'string') return { ...(map || {}) };
  const next = { ...(map || {}), [tableId]: at };
  const ids = Object.keys(next);
  if (ids.length <= TABLE_NAV_ACCESS_MAX_ENTRIES) return next;
  ids.sort((a, b) => next[a] - next[b]);
  for (const id of ids.slice(0, ids.length - TABLE_NAV_ACCESS_MAX_ENTRIES)) {
    delete next[id];
  }
  return next;
}

export function loadTableNavAccessMap(uid) {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(tableNavAccessStorageKey(uid));
    if (!raw) return {};
    return parseTableNavAccessMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function persistTableNavAccess(uid, tableId, at = Date.now()) {
  const next = stampTableNavAccess(loadTableNavAccessMap(uid), tableId, at);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(tableNavAccessStorageKey(uid), JSON.stringify(next));
    } catch {
      /* quota / private mode */
    }
  }
  return next;
}

export function navTableDisplayLabel(name, gmName) {
  const raw = typeof name === 'string' ? name.trim() : '';
  if (raw && raw !== 'New Table') return raw;
  if (typeof gmName === 'string' && gmName.trim()) return `${gmName.trim()}'s Game Table`;
  return 'Game Table';
}

/**
 * @param {Array<{ id?: string, name?: string, updatedAt?: number }>} myTables
 * @param {Array<{ tableId?: string, tableName?: string, name?: string, gmName?: string, updatedAt?: number }>} myRooms
 * @returns {Array<{ tableId: string, label: string, updatedAt: number }>}
 */
export function collectNavTableEntries(myTables = [], myRooms = []) {
  const seen = new Set();
  const entries = [];
  const push = (tableId, label, updatedAt) => {
    if (!tableId || seen.has(tableId)) return;
    seen.add(tableId);
    entries.push({ tableId, label, updatedAt: Number(updatedAt) || 0 });
  };
  for (const t of myTables) {
    push(t?.id, navTableDisplayLabel(t?.name), t?.updatedAt);
  }
  for (const room of myRooms) {
    push(room?.tableId, navTableDisplayLabel(room?.tableName || room?.name, room?.gmName), room?.updatedAt);
  }
  return entries;
}

export function pickRecentNavTables(entries = [], {
  accessByTableId = {},
  currentTableId = null,
  limit = NAV_RECENT_TABLE_LIMIT,
} = {}) {
  const cap = Math.max(0, Number(limit) || 0);
  const scored = entries.map((entry, index) => ({
    entry,
    index,
    isCurrent: !!currentTableId && entry.tableId === currentTableId,
    access: Number(accessByTableId[entry.tableId]) || 0,
    updated: Number(entry.updatedAt) || 0,
  }));
  scored.sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    if (b.access !== a.access) return b.access - a.access;
    if (b.updated !== a.updated) return b.updated - a.updated;
    return a.index - b.index;
  });
  return scored.slice(0, cap).map((s) => s.entry);
}

export function shouldShowNavMoreTables(entryCount, limit = NAV_RECENT_TABLE_LIMIT) {
  return Number(entryCount) > Number(limit);
}
