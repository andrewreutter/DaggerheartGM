/**
 * Library SRD tabs: filter dimensions (tier, level, typed filters, sort, include scaled)
 * shared across all unified collection tabs + the “All” tab — same idea as
 * LIBRARY_SEARCH_GLOBAL_KEY / LIBRARY_INCLUDES_GLOBAL_KEY.
 */

import { getLibraryFilterConfig } from './library-filter-config.js';
import {
  LIBRARY_DEFAULT_INCLUDES,
  normalizePersistedIncludes,
  normalizeIncludesForLibrary,
  normalizeSinglePickList,
} from './library-default-filters.js';
import { readSharedSearchQuery, readSharedIncludes } from './library-filter-config.js';

export const LIBRARY_SHARED_FILTERS_KEY = 'dh_library_shared_filters_v2';

/** Collapse legacy multi-select tier/level arrays to a single value (library filters are single-select). */
export function normalizeTierList(tiers) {
  if (!Array.isArray(tiers) || tiers.length === 0) return [];
  if (tiers.length === 1) return [tiers[0]];
  return [[...new Set(tiers)].sort((a, b) => a - b)[0]];
}

export { normalizeSinglePickList, normalizeBinaryPickList } from './library-default-filters.js';

/** @param {number[]} levels */
export function normalizeLevelList(levels) {
  if (!Array.isArray(levels) || levels.length === 0) return [];
  if (levels.length === 1) return [levels[0]];
  return [[...new Set(levels)].sort((a, b) => a - b)[0]];
}

/** Dimensions stored under LIBRARY_SHARED_FILTERS_KEY (no search / includes). */
export const DEFAULT_SHARED_FILTERS = {
  tiers: [],
  levels: [],
  advRole: [],
  envType: [],
  ablDomain: [],
  wpnSlot: [],
  wpnPhyMag: [],
  featScope: [],
  includeScaledUp: false,
};

/** @typedef {'tier'|'level'|'advRole'|'envType'|'ablDomain'|'weapon'|'featScope'} LibraryStructuralGroup */

/**
 * @param {object} state - shared filter blob (tiers, levels, advRole, …)
 * @param {LibraryStructuralGroup} group
 */
export function groupIsActiveInSharedFilters(state, group) {
  if (!state) return false;
  switch (group) {
    case 'tier':
      return (state.tiers?.length ?? 0) > 0;
    case 'level':
      return (state.levels?.length ?? 0) > 0;
    case 'advRole':
      return (state.advRole?.length ?? 0) > 0;
    case 'envType':
      return (state.envType?.length ?? 0) > 0;
    case 'ablDomain':
      return (state.ablDomain?.length ?? 0) > 0;
    case 'weapon':
      return (state.wpnSlot?.length ?? 0) > 0 || (state.wpnPhyMag?.length ?? 0) > 0;
    case 'featScope':
      return (state.featScope?.length ?? 0) > 0;
    default:
      return false;
  }
}

/**
 * First non-empty structural group (priority) — used when reconciling legacy multi-group storage.
 * @param {object} state
 * @returns {LibraryStructuralGroup | null}
 */
export function getFirstActiveStructuralGroup(state) {
  if (groupIsActiveInSharedFilters(state, 'tier')) return 'tier';
  if (groupIsActiveInSharedFilters(state, 'level')) return 'level';
  if (groupIsActiveInSharedFilters(state, 'advRole')) return 'advRole';
  if (groupIsActiveInSharedFilters(state, 'envType')) return 'envType';
  if (groupIsActiveInSharedFilters(state, 'ablDomain')) return 'ablDomain';
  if (groupIsActiveInSharedFilters(state, 'weapon')) return 'weapon';
  if (groupIsActiveInSharedFilters(state, 'featScope')) return 'featScope';
  return null;
}

/**
 * When another structural group is active, a row’s “All” should not use the selected (active) highlight.
 * @param {LibraryStructuralGroup | null} activeGroup
 * @param {LibraryStructuralGroup | null} rowGroup
 */
export function shouldSuppressStructuralAllHighlight(activeGroup, rowGroup) {
  return activeGroup != null && rowGroup != null && activeGroup !== rowGroup;
}

/**
 * Which structural group a Library collection filter row belongs to (for highlight suppression).
 * @param {string} collection
 * @param {'rank'|'type'|'extraType'} row
 * @returns {LibraryStructuralGroup | null}
 */
export function getStructuralRowGroupForCollection(collection, row) {
  const cfg = getLibraryFilterConfig(collection);
  if (row === 'rank') {
    if (cfg.rankMode === 'none') return null;
    return cfg.rankMode === 'level' ? 'level' : 'tier';
  }
  if (row === 'type') {
    if (collection === 'adversaries') return 'advRole';
    if (collection === 'environments') return 'envType';
    if (collection === 'abilities') return 'ablDomain';
    if (collection === 'weapons') return 'weapon';
    if (collection === 'features') return 'featScope';
    return null;
  }
  if (row === 'extraType') {
    if (collection === 'weapons') return 'weapon';
    return null;
  }
  return null;
}

/**
 * @param {object} state
 * @param {LibraryStructuralGroup} activeGroup
 */
export function clearOtherStructuralGroups(state, activeGroup) {
  const n = { ...state };
  if (activeGroup !== 'tier') {
    n.tiers = [];
    n.includeScaledUp = false;
  }
  if (activeGroup !== 'level') n.levels = [];
  if (activeGroup !== 'advRole') n.advRole = [];
  if (activeGroup !== 'envType') n.envType = [];
  if (activeGroup !== 'ablDomain') n.ablDomain = [];
  if (activeGroup !== 'weapon') {
    n.wpnSlot = [];
    n.wpnPhyMag = [];
  }
  if (activeGroup !== 'featScope') n.featScope = [];
  return n;
}

/**
 * @param {object} state
 * @param {{ preferredGroup?: LibraryStructuralGroup | null }} [opts]
 */
export function normalizeSharedStructuralExclusivity(state, opts = {}) {
  const { preferredGroup } = opts;
  const s = { ...state };
  if (preferredGroup && groupIsActiveInSharedFilters(s, preferredGroup)) {
    return clearOtherStructuralGroups(s, preferredGroup);
  }
  const first = getFirstActiveStructuralGroup(s);
  if (!first) return s;
  return clearOtherStructuralGroups(s, first);
}

/**
 * Map `useCollectionSearch` setFilter key + collection to a structural group (for preferred winner).
 * @param {string} collection
 * @param {string} key
 */
export function structuralGroupFromCollectionFilterKey(collection, key) {
  if (key === 'includeScaledUp') return 'tier';
  if (key === 'tier') {
    const cfg = getLibraryFilterConfig(collection);
    return cfg.rankMode === 'level' ? 'level' : 'tier';
  }
  if (key === 'type') {
    if (collection === 'adversaries') return 'advRole';
    if (collection === 'environments') return 'envType';
    if (collection === 'abilities') return 'ablDomain';
    if (collection === 'weapons') return 'weapon';
    if (collection === 'features') return 'featScope';
  }
  if (key === 'extraType') return 'weapon';
  return null;
}

/**
 * Map Library “All” `setFilter` key to structural group.
 * @param {string} key
 * @returns {LibraryStructuralGroup | null}
 */
export function structuralGroupFromLibraryAllKey(key) {
  if (key === 'tier') return 'tier';
  if (key === 'level') return 'level';
  if (key === 'advRole') return 'advRole';
  if (key === 'envType') return 'envType';
  if (key === 'ablDomain') return 'ablDomain';
  if (key === 'wpnSlot' || key === 'wpnPhyMag') return 'weapon';
  if (key === 'featScope') return 'featScope';
  return null;
}

export function readSharedLibraryFilters() {
  try {
    const raw = localStorage.getItem(LIBRARY_SHARED_FILTERS_KEY);
    if (!raw) return { ...DEFAULT_SHARED_FILTERS };
    const parsed = JSON.parse(raw);
    const merged = { ...DEFAULT_SHARED_FILTERS, ...parsed };
    return normalizeSharedStructuralExclusivity(merged);
  } catch {
    return { ...DEFAULT_SHARED_FILTERS };
  }
}

/**
 * @param {object} shared - partial or full shared blob (sort may be included)
 * @param {{ preferredGroup?: LibraryStructuralGroup | null }} [opts]
 */
export function writeSharedLibraryFilters(shared, opts = {}) {
  try {
    const merged = { ...DEFAULT_SHARED_FILTERS, ...shared };
    const normalized = normalizeSharedStructuralExclusivity(merged, opts);
    localStorage.setItem(LIBRARY_SHARED_FILTERS_KEY, JSON.stringify(normalized));
  } catch { /* ignore */ }
}

/** Clears every structural dimension in shared library storage; keeps `sort` and other non-structural keys. */
export function clearAllStructuralSharedFilters() {
  const cur = readSharedLibraryFilters();
  writeSharedLibraryFilters({
    ...cur,
    tiers: [],
    levels: [],
    advRole: [],
    envType: [],
    ablDomain: [],
    wpnSlot: [],
    wpnPhyMag: [],
    featScope: [],
    includeScaledUp: false,
  });
}

/** `setFilter` key: clear all structural filters (shared + UI “release lock” from suppressed “All”). */
export const LIBRARY_STRUCTURAL_RESET_KEY = 'structuralReset';

/** True when nothing meaningful is stored yet (migration may run). */
export function isSharedFiltersUnset(shared) {
  const s = { ...DEFAULT_SHARED_FILTERS, ...shared };
  return (
    !s.tiers?.length
    && !s.levels?.length
    && !s.advRole?.length
    && !s.envType?.length
    && !s.ablDomain?.length
    && !s.wpnSlot?.length
    && !s.wpnPhyMag?.length
    && !s.featScope?.length
    && !s.includeScaledUp
    && (s.sort == null || s.sort === '')
  );
}

/**
 * Build `useCollectionSearch` filter state from shared storage + per-tab defaults.
 */
export function sharedToCollectionFilters(collection, shared, baseFilters) {
  const s = { ...DEFAULT_SHARED_FILTERS, ...shared };
  const cfg = getLibraryFilterConfig(collection);

  let tiers = [];
  if (cfg.rankMode === 'level') tiers = normalizeLevelList(s.levels || []);
  else if (cfg.rankMode === 'tier') tiers = normalizeTierList(s.tiers || []);

  let types = [];
  let extraTypes = [];
  if (collection === 'adversaries') types = normalizeSinglePickList(s.advRole || []);
  else if (collection === 'environments') types = normalizeSinglePickList(s.envType || []);
  else if (collection === 'abilities') types = normalizeSinglePickList(s.ablDomain || []);
  else if (collection === 'weapons') {
    types = normalizeSinglePickList(s.wpnSlot || []);
    extraTypes = normalizeSinglePickList(s.wpnPhyMag || []);
  } else if (collection === 'features') {
    types = normalizeSinglePickList(s.featScope || []);
  }

  const sort = s.sort != null && s.sort !== ''
    ? s.sort
    : (baseFilters.sort ?? cfg.defaultSort ?? 'popularity');

  return {
    tiers,
    types,
    extraTypes,
    search: '',
    includeScaledUp: collection === 'adversaries' ? !!s.includeScaledUp : false,
    sort,
  };
}

/**
 * Merge current tab’s filter state into the shared blob.
 * @param {string} [mutatingKey] - `useCollectionSearch` setFilter key so the winning structural group clears others.
 */
export function mergeSharedFromCollectionFilters(collection, filters, prevShared = null, mutatingKey = null) {
  const shared = { ...(prevShared ?? readSharedLibraryFilters()) };
  const cfg = getLibraryFilterConfig(collection);

  if (cfg.rankMode === 'level') {
    shared.levels = normalizeLevelList(filters.tiers || []);
  } else if (cfg.rankMode === 'tier') {
    shared.tiers = normalizeTierList(filters.tiers || []);
  }

  if (collection === 'adversaries') {
    shared.advRole = normalizeSinglePickList(filters.types || []);
    shared.includeScaledUp = !!filters.includeScaledUp;
  } else if (collection === 'environments') {
    shared.envType = normalizeSinglePickList(filters.types || []);
  } else if (collection === 'abilities') {
    shared.ablDomain = normalizeSinglePickList(filters.types || []);
  } else if (collection === 'weapons') {
    shared.wpnSlot = normalizeSinglePickList(filters.types || []);
    shared.wpnPhyMag = normalizeSinglePickList(filters.extraTypes || []);
  } else if (collection === 'features') {
    shared.featScope = normalizeSinglePickList(filters.types || []);
  }

  if (filters.sort != null) shared.sort = filters.sort;

  const preferredGroup = mutatingKey ? structuralGroupFromCollectionFilterKey(collection, mutatingKey) : null;
  return normalizeSharedStructuralExclusivity(shared, { preferredGroup });
}

/**
 * One-time migration from per-tab `dh_collectionFilters_v2_${collection}` or `_all`.
 */
export function tryMigrateLegacyLibraryFilters(persistKey, collection, baseFilters, sharedSearchKey, sharedIncludesKey) {
  if (!persistKey || !isSharedFiltersUnset(readSharedLibraryFilters())) return;

  const tryParse = (key) => {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      let parsed = JSON.parse(stored);
      if (parsed.tier != null && !Array.isArray(parsed.tiers)) parsed.tiers = [parsed.tier];
      if (parsed.type && !Array.isArray(parsed.types)) parsed.types = [parsed.type];
      if (parsed.extraType && !Array.isArray(parsed.extraTypes)) parsed.extraTypes = [parsed.extraType];
      if (parsed.include != null && !Array.isArray(parsed.includes)) {
        parsed.includes = parsed.include === null ? [] : [parsed.include];
      }
      if (sharedSearchKey) delete parsed.search;
      if (sharedIncludesKey) delete parsed.includes;
      return parsed;
    } catch {
      return null;
    }
  };

  const fromCollection = tryParse(`${persistKey}_${collection}`);
  const fromAll = tryParse(`${persistKey}_all`);
  const raw = fromCollection || fromAll;
  if (!raw) return;

  const merged = {
    includes: [...LIBRARY_DEFAULT_INCLUDES],
    tiers: [],
    types: [],
    extraTypes: [],
    search: '',
    includeScaledUp: false,
    sort: 'popularity',
    ...baseFilters,
    ...raw,
  };
  merged.includes = normalizePersistedIncludes(merged.includes);

  const shared = mergeSharedFromCollectionFilters(collection, merged, DEFAULT_SHARED_FILTERS);
  writeSharedLibraryFilters(shared);
}

/**
 * Migrate legacy `dh_collectionFilters_v2_all` into LIBRARY_SHARED_FILTERS_KEY.
 */
export function tryMigrateLegacyLibraryAll(persistKey, sharedSearchKey, sharedIncludesKey) {
  if (!persistKey || !isSharedFiltersUnset(readSharedLibraryFilters())) return;
  try {
    const stored = localStorage.getItem(`${persistKey}_all`);
    if (!stored) return;
    let parsed = JSON.parse(stored);
    if (parsed.tier != null && !Array.isArray(parsed.tiers)) parsed.tiers = [parsed.tier];
    if (parsed.include != null && !Array.isArray(parsed.includes)) {
      parsed.includes = parsed.include === null ? [] : [parsed.include];
    }
    if (sharedSearchKey) delete parsed.search;
    if (sharedIncludesKey) delete parsed.includes;
    const shared = {
      ...DEFAULT_SHARED_FILTERS,
      tiers: parsed.tiers || [],
      levels: parsed.levels || [],
      advRole: parsed.advRole || [],
      envType: parsed.envType || [],
      ablDomain: parsed.ablDomain || [],
      wpnSlot: parsed.wpnSlot || [],
      wpnPhyMag: parsed.wpnPhyMag || [],
      featScope: parsed.featScope || [],
      sort: parsed.sort,
      includeScaledUp: !!parsed.includeScaledUp,
    };
    writeSharedLibraryFilters(shared);
  } catch { /* ignore */ }
}

/**
 * Initial filter state for `useLibraryAllSearch` (includes search/includes globals).
 */
export function loadAllFiltersFromShared(persistKey, sharedSearchKey, sharedIncludesKey) {
  tryMigrateLegacyLibraryAll(persistKey, sharedSearchKey, sharedIncludesKey);
  const shared = readSharedLibraryFilters();
  const merged = {
    includes: [...LIBRARY_DEFAULT_INCLUDES],
    tiers: normalizeTierList(shared.tiers || []),
    levels: normalizeLevelList(shared.levels || []),
    advRole: normalizeSinglePickList(shared.advRole || []),
    envType: normalizeSinglePickList(shared.envType || []),
    ablDomain: normalizeSinglePickList(shared.ablDomain || []),
    wpnSlot: normalizeSinglePickList(shared.wpnSlot || []),
    wpnPhyMag: normalizeSinglePickList(shared.wpnPhyMag || []),
    featScope: normalizeSinglePickList(shared.featScope || []),
    search: '',
    includeScaledUp: !!shared.includeScaledUp,
    sort: shared.sort != null && shared.sort !== '' ? shared.sort : 'popularity',
  };
  if (sharedSearchKey) merged.search = readSharedSearchQuery(sharedSearchKey);
  if (sharedIncludesKey) {
    const inc = readSharedIncludes(sharedIncludesKey);
    if (inc != null) merged.includes = inc;
  }
  merged.includes = normalizeIncludesForLibrary(merged.includes);
  return merged;
}
