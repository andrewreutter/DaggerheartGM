/** Default source filter for library browse (Mine + SRD). Shared by `useCollectionSearch` and empty-state reset UI. */
export const LIBRARY_DEFAULT_INCLUDES = Object.freeze(['own', 'srd']);

/**
 * Single-select source modes for the Library Include strip (maps to `includes` arrays for the API).
 * Order matches the segmented control left → right.
 */
export const LIBRARY_SOURCE_MODE_OPTIONS = Object.freeze([
  { mode: 'all', label: 'All' },
  { mode: 'mine_srd', label: 'Mine+SRD' },
  { mode: 'own', label: 'Mine' },
  { mode: 'srd', label: 'SRD' },
  { mode: 'public', label: 'Public' },
]);

/** Strips removed source keys from persisted `includes` (e.g. HoD toggle removed from UI). */
export function normalizePersistedIncludes(includes) {
  if (!Array.isArray(includes)) return includes;
  return includes.filter(s => s !== 'hod' && s !== 'fcg');
}

/**
 * Derives the active Include mode from a persisted `includes` array (exclusive single-select + Mine+SRD preset).
 * @returns {'all'|'mine_srd'|'own'|'srd'|'public'}
 */
export function getLibraryIncludeMode(includes) {
  const cleaned = normalizePersistedIncludes(Array.isArray(includes) ? [...includes] : []);
  if (!Array.isArray(cleaned)) return 'all';
  const filtered = cleaned.filter(s => s !== 'reddit').sort();
  const key = filtered.join(',');
  if (key === '') return 'all';
  if (key === 'own,srd') return 'mine_srd';
  if (key === 'own') return 'own';
  if (key === 'srd') return 'srd';
  if (key === 'public') return 'public';
  if (filtered.length === 1) return /** @type {'own'|'srd'|'public'} */ (filtered[0]);
  if (filtered.includes('own') && filtered.includes('srd')) return 'mine_srd';
  return /** @type {'own'|'srd'|'public'} */ (filtered[0]);
}

/**
 * @param {'all'|'mine_srd'|'own'|'srd'|'public'|null|undefined} mode
 * @returns {string[]} API `includes` list (`[]` = all sources).
 */
export function includesFromIncludeMode(mode) {
  if (mode == null || mode === 'all') return [];
  if (mode === 'mine_srd') return ['own', 'srd'];
  if (mode === 'own') return ['own'];
  if (mode === 'srd') return ['srd'];
  if (mode === 'public') return ['public'];
  return [];
}

/** Official catalog cache `source` for a library collection (`includeSrd` still gates the query). */
export function catalogCacheSourceForCollection(collection) {
  return collection === 'scenes' || collection === 'maps' ? 'dt' : 'srd';
}

/**
 * Include-strip options. Persist/API modes stay `mine_srd` / `srd`; Scenes and Maps remap the visible labels to DT.
 * @param {string} [collection]
 */
export function librarySourceModeOptionsForCollection(collection) {
  if (collection !== 'scenes' && collection !== 'maps') return LIBRARY_SOURCE_MODE_OPTIONS;
  return Object.freeze([
    { mode: 'all', label: 'All' },
    { mode: 'mine_srd', label: 'Mine+DT' },
    { mode: 'own', label: 'Mine' },
    { mode: 'srd', label: 'DT' },
    { mode: 'public', label: 'Public' },
  ]);
}

/** Canonical storage shape for Include (single mode, no redundant multi-select arrays). */
export function canonicalizeIncludesArray(includes) {
  return includesFromIncludeMode(getLibraryIncludeMode(includes));
}

/** Strips removed keys, then canonicalizes to a valid single-select `includes` array. */
export function normalizeIncludesForLibrary(includes) {
  const n = normalizePersistedIncludes(includes);
  if (!Array.isArray(n)) return [];
  return canonicalizeIncludesArray(n);
}

/** At most one typed filter value (All = empty array). */
export function normalizeSinglePickList(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  return [arr[0]];
}

/** @deprecated use normalizeSinglePickList */
export const normalizeBinaryPickList = normalizeSinglePickList;
