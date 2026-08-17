import { LIBRARY_READONLY_SRD_COLLECTIONS, LIBRARY_USER_EDITABLE_COLLECTIONS } from '../client/lib/library-filter-config.js';

export function isCatalogSourceValue(source) {
  return source === 'srd' || source === 'dt';
}

export function isAdminCatalogEditableCollection(collection) {
  if (!collection || collection === 'features') return false;
  if (LIBRARY_READONLY_SRD_COLLECTIONS.has(collection)) return false;
  return LIBRARY_USER_EDITABLE_COLLECTIONS.has(collection);
}

/**
 * Gate for admin in-place catalog writes. `not-catalog` means the caller should use the Mine upsert path.
 * @returns {{ ok: true } | { ok: false, reason: 'not-catalog' } | { ok: false, status: number, error: string }}
 */
export function assertAdminCatalogWrite({ isAdmin, collection, source }) {
  if (!isCatalogSourceValue(source)) return { ok: false, reason: 'not-catalog' };
  if (!isAdmin) return { ok: false, status: 403, error: 'Admin access required' };
  if (!isAdminCatalogEditableCollection(collection)) {
    return { ok: false, status: 403, error: 'Catalog collection is not editable' };
  }
  return { ok: true };
}

/**
 * Resolve a catalog PUT before any `upsertItem`. `handled: false` means use the Mine path.
 * @param {{ isAdmin: boolean, collection: string, source: string, cachedRows?: object[] }} opts
 */
export function resolveAdminCatalogPut({ isAdmin, collection, source, cachedRows }) {
  const gate = assertAdminCatalogWrite({ isAdmin, collection, source });
  if (gate.reason === 'not-catalog') return { handled: false };
  if (!gate.ok) return { handled: true, status: gate.status, error: gate.error };
  if (!cachedRows?.length) return { handled: true, status: 404, error: 'Catalog item not found' };
  const existingSource = cachedRows[0]._source;
  const catalogSource = existingSource === 'dt' || existingSource === 'srd' ? existingSource : source;
  return { handled: true, ok: true, source: catalogSource };
}

export function stampAdminCatalogData(data, source, editedAt = new Date().toISOString()) {
  return { ...data, _source: source, _adminEditedAt: editedAt };
}

/**
 * Strip cache-row meta so we persist only item JSON (+ `_source` / `_adminEditedAt`).
 */
export function catalogItemDataFromCacheRow(row) {
  if (!row || typeof row !== 'object') return {};
  const {
    id: _id,
    _source: _s,
    _owner: _o,
    clone_count: _cc,
    play_count: _pc,
    popularity: _pop,
    is_public: _ip,
    ...data
  } = row;
  return data;
}
