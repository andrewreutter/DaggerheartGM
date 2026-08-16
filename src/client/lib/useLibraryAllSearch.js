import { useState, useEffect, useRef, useCallback } from 'react';
import { buildLibraryAllApiOpts } from './library-all-api-params.js';
import { loadLibraryAll } from './api.js';
import {
  LIBRARY_DEFAULT_INCLUDES,
  normalizePersistedIncludes,
  normalizeIncludesForLibrary,
  includesFromIncludeMode,
  normalizeSinglePickList,
} from './library-default-filters.js';
import {
  LIBRARY_FILTERS_PERSIST_KEY,
  LIBRARY_SEARCH_GLOBAL_KEY,
  LIBRARY_INCLUDES_GLOBAL_KEY,
} from './library-filter-config.js';
import {
  loadAllFiltersFromShared,
  writeSharedLibraryFilters,
  readSharedLibraryFilters,
  clearAllStructuralSharedFilters,
  normalizeTierList,
  normalizeLevelList,
  normalizeSharedStructuralExclusivity,
  structuralGroupFromLibraryAllKey,
  groupIsActiveInSharedFilters,
  LIBRARY_STRUCTURAL_RESET_KEY,
} from './library-shared-filters.js';
import { applyLibraryAllAdversaryScaling } from './library-adversary-scaling.js';

const DEFAULT_FILTERS = {
  includes: [...LIBRARY_DEFAULT_INCLUDES],
  tiers: [],
  levels: [],
  advRole: [],
  envType: [],
  ablDomain: [],
  wpnSlot: [],
  wpnPhyMag: [],
  featScope: [],
  search: '',
  semantic: '',
  includeScaledUp: false,
  sort: 'popularity',
};

export { buildLibraryAllApiOpts };

/**
 * Library “All” tab: merged SRD unified collections + combined filters.
 */
export function useLibraryAllSearch({
  limit = 20,
  debounceMs = 400,
  persistKey = LIBRARY_FILTERS_PERSIST_KEY,
  sharedSearchKey = LIBRARY_SEARCH_GLOBAL_KEY,
  sharedIncludesKey = LIBRARY_INCLUDES_GLOBAL_KEY,
  infinite = true,
  maxItems = 500,
  enabled = true,
} = {}) {
  const [filters, setFiltersState] = useState(() =>
    loadAllFiltersFromShared(persistKey, sharedSearchKey, sharedIncludesKey)
  );
  const [offset, setOffsetState] = useState(0);
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [nextOffset, setNextOffsetState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [trimmedCount, setTrimmedCount] = useState(0);
  const [countsByCollection, setCountsByCollection] = useState(null);

  const debounceRef = useRef(null);
  const isLoadingMoreRef = useRef(false);
  const abortControllerRef = useRef(null);
  const prevEnabledRef = useRef(enabled);

  useEffect(() => {
    const wasDisabled = prevEnabledRef.current === false;
    prevEnabledRef.current = enabled;
    if (!enabled) return;
    if (!wasDisabled) return;
    setFiltersState(loadAllFiltersFromShared(persistKey, sharedSearchKey, sharedIncludesKey));
    setOffsetState(0);
    setItems([]);
    setTotalCount(0);
    setNextOffsetState(null);
    setIsLoadingMore(false);
    isLoadingMoreRef.current = false;
    setTrimmedCount(0);
    setCountsByCollection(null);
  }, [enabled, persistKey, sharedSearchKey, sharedIncludesKey]);

  const getLoadOpts = useCallback(() => buildLibraryAllApiOpts(filters), [filters]);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setTotalCount(0);
      setCountsByCollection(null);
      return;
    }
    const appendMode = infinite && isLoadingMoreRef.current;

    const doFetch = async () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      setLoading(true);
      if (!appendMode) {
        setCountsByCollection(null);
      }
      try {
        const o = getLoadOpts();
        const result = await loadLibraryAll({
          ...o,
          offset,
          limit,
        });
        const rawItems = result.items || [];
        const scaled = applyLibraryAllAdversaryScaling(rawItems, filters);

        if (appendMode) {
          setItems(prev => {
            const merged = [...prev, ...scaled];
            if (maxItems && merged.length > maxItems) {
              const excess = merged.length - maxItems;
              setTrimmedCount(tc => tc + excess);
              return merged.slice(excess);
            }
            return merged;
          });
        } else {
          setItems(scaled);
          setTrimmedCount(0);
        }
        setTotalCount(result.totalCount || 0);
        setNextOffsetState(result.nextOffset ?? offset + scaled.length);
        if (!appendMode && result.countsByCollection && typeof result.countsByCollection === 'object') {
          setCountsByCollection(result.countsByCollection);
        }
      } catch (err) {
        if (err.name !== 'AbortError') console.error('useLibraryAllSearch failed:', err);
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
        isLoadingMoreRef.current = false;
      }
    };

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(doFetch, (filters.search || filters.semantic) ? debounceMs : 0);
    return () => {
      clearTimeout(debounceRef.current);
      abortControllerRef.current?.abort();
    };
  }, [filters, offset, limit, debounceMs, refreshKey, infinite, maxItems, getLoadOpts, enabled]);

  const setFilter = (key, value) => {
    setFiltersState(prev => {
      let next = { ...prev };
      if (key === LIBRARY_STRUCTURAL_RESET_KEY) {
        clearAllStructuralSharedFilters();
        const shared = readSharedLibraryFilters();
        next = {
          ...next,
          tiers: normalizeTierList(shared.tiers || []),
          levels: normalizeLevelList(shared.levels || []),
          advRole: normalizeSinglePickList(shared.advRole || []),
          envType: normalizeSinglePickList(shared.envType || []),
          ablDomain: normalizeSinglePickList(shared.ablDomain || []),
          wpnSlot: normalizeSinglePickList(shared.wpnSlot || []),
          wpnPhyMag: normalizeSinglePickList(shared.wpnPhyMag || []),
          featScope: normalizeSinglePickList(shared.featScope || []),
          includeScaledUp: !!shared.includeScaledUp,
          sort: shared.sort != null && shared.sort !== '' ? shared.sort : next.sort,
        };
      } else if (key === 'tier') {
        if (value == null) next = { ...next, tiers: [], includeScaledUp: false };
        else if (typeof value === 'object' && value !== null && 'tier' in value) {
          const t = Number(value.tier);
          next = {
            ...next,
            tiers: Number.isFinite(t) ? [t] : [],
            includeScaledUp: !!value.scaled,
          };
        } else if (typeof value === 'number') {
          next = { ...next, tiers: [value], includeScaledUp: false };
        }
      } else if (key === 'level') {
        if (value == null) next = { ...next, levels: [] };
        else if (typeof value === 'number') next = { ...next, levels: [value] };
      } else if (
        key === 'wpnSlot'
        || key === 'wpnPhyMag'
        || key === 'advRole'
        || key === 'envType'
        || key === 'ablDomain'
        || key === 'featScope'
      ) {
        if (value == null) next = { ...next, [key]: [] };
        else {
          const arr = next[key] || [];
          const cur = arr[0];
          next[key] = cur === value ? [] : [value];
        }
      } else if (key === 'include') {
        next = { ...next, includes: includesFromIncludeMode(value) };
      } else if (key === 'includes') {
        next = { ...next, includes: normalizeIncludesForLibrary(normalizePersistedIncludes(value) ?? []) };
      } else {
        next[key] = value;
      }
      if (key !== LIBRARY_STRUCTURAL_RESET_KEY) {
        next.tiers = normalizeTierList(next.tiers || []);
        next.levels = normalizeLevelList(next.levels || []);
        const grp = structuralGroupFromLibraryAllKey(key);
        next = grp && groupIsActiveInSharedFilters(next, grp)
          ? normalizeSharedStructuralExclusivity(next, { preferredGroup: grp })
          : normalizeSharedStructuralExclusivity(next);
      }
      if (key === 'search' && sharedSearchKey) {
        try { localStorage.setItem(sharedSearchKey, typeof value === 'string' ? value : ''); } catch {}
      }
      if ((key === 'include' || key === 'includes') && sharedIncludesKey) {
        try { localStorage.setItem(sharedIncludesKey, JSON.stringify(next.includes ?? [])); } catch {}
      }
      const toSave = { ...next };
      if (sharedSearchKey) delete toSave.search;
      if (sharedIncludesKey) delete toSave.includes;
      writeSharedLibraryFilters(toSave);
      return next;
    });
    setOffsetState(0);
    setIsLoadingMore(false);
    isLoadingMoreRef.current = false;
    setTrimmedCount(0);
    setItems([]);
    setLoading(true);
  };

  const refresh = useCallback(() => {
    setLoading(true);
    setRefreshKey(k => k + 1);
  }, []);

  const patchItems = (patchMap) => {
    setItems(prev => prev.map(item => {
      const k = `${item._collection || ''}:${item.id}`;
      const p = patchMap[k] || patchMap[item.id];
      return p ? { ...item, ...p } : item;
    }));
  };

  const hasMore = infinite ? (items.length + trimmedCount < totalCount) : false;

  const loadMore = () => {
    if (!infinite || !hasMore || loading || isLoadingMore) return;
    setIsLoadingMore(true);
    isLoadingMoreRef.current = true;
    setOffsetState(nextOffset ?? offset + limit);
  };

  return {
    items,
    totalCount,
    nextOffset,
    loading,
    filters,
    setFilter,
    offset,
    refresh,
    patchItems,
    hasMore,
    isLoadingMore,
    loadMore,
    trimmedCount,
    getLoadOpts,
    countsByCollection,
  };
}
