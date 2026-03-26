import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { loadCollection } from './api.js';
import { computeScaledStats, ROLE_STAT_SCALING } from './adversary-defaults.js';
import { readSharedSearchQuery, readSharedIncludes } from './library-filter-config.js';
import { LIBRARY_DEFAULT_INCLUDES, normalizePersistedIncludes } from './library-default-filters.js';

const DEFAULT_FILTERS = {
  includes: [...LIBRARY_DEFAULT_INCLUDES],
  tiers: [],
  types: [],
  extraTypes: [],
  search: '',
  includeScaledUp: false,
  sort: 'popularity',
};

function loadPersistedFilters(
  persistKey,
  collection,
  baseFilters = DEFAULT_FILTERS,
  sharedSearchKey = null,
  sharedIncludesKey = null
) {
  const defaults = { ...DEFAULT_FILTERS, ...baseFilters };
  let merged = { ...defaults };

  if (persistKey) {
    try {
      const stored = localStorage.getItem(`${persistKey}_${collection}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.tier != null && !Array.isArray(parsed.tiers)) parsed.tiers = [parsed.tier];
        if (parsed.type && !Array.isArray(parsed.types)) parsed.types = [parsed.type];
        if (parsed.extraType && !Array.isArray(parsed.extraTypes)) parsed.extraTypes = [parsed.extraType];
        if (parsed.include != null && !Array.isArray(parsed.includes)) {
          parsed.includes = parsed.include === null ? [] : [parsed.include];
        }
        if (sharedSearchKey) delete parsed.search;
        if (sharedIncludesKey) delete parsed.includes;
        merged = { ...defaults, ...parsed };
        merged.includes = normalizePersistedIncludes(merged.includes);
      }
    } catch {}
  }

  if (sharedSearchKey) {
    merged = { ...merged, search: readSharedSearchQuery(sharedSearchKey) };
  }

  if (sharedIncludesKey) {
    const shared = readSharedIncludes(sharedIncludesKey);
    if (shared != null) merged.includes = shared;
  }

  return merged;
}

/**
 * Shared hook for fetching, filtering, and paginating a single collection.
 * Uses unified API with traditional OFFSET/LIMIT pagination.
 */
export function useCollectionSearch(collection, {
  limit = 20,
  debounceMs = 300,
  persistKey = null,
  /** When set, `filters.search` is read/written only under this key (library-wide), not per-collection persist. */
  sharedSearchKey = null,
  /** When set, `filters.includes` (source filter) is read/written only under this key (library-wide), not per-tab persist. */
  sharedIncludesKey = null,
  defaultFilters = {},
  enabled = true,
  infinite = false,
  maxItems = null,
} = {}) {
  const baseFilters = useMemo(() => ({ ...DEFAULT_FILTERS, ...defaultFilters }), [defaultFilters]);
  const [filters, setFiltersState] = useState(() =>
    loadPersistedFilters(
      persistKey,
      collection,
      { ...DEFAULT_FILTERS, ...defaultFilters },
      sharedSearchKey,
      sharedIncludesKey
    )
  );
  const [offset, setOffsetState] = useState(0);
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [nextOffset, setNextOffsetState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [trimmedCount, setTrimmedCount] = useState(0);

  const prevCollectionRef = useRef(collection);
  const debounceRef = useRef(null);
  const isLoadingMoreRef = useRef(false);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    if (prevCollectionRef.current !== collection) {
      prevCollectionRef.current = collection;
      setFiltersState(loadPersistedFilters(persistKey, collection, baseFilters, sharedSearchKey, sharedIncludesKey));
      setOffsetState(0);
      setItems([]);
      setTotalCount(0);
      setNextOffsetState(null);
      setIsLoadingMore(false);
      isLoadingMoreRef.current = false;
      setTrimmedCount(0);
    }
  }, [collection, persistKey, baseFilters, sharedSearchKey, sharedIncludesKey]);

  const getLoadOpts = useCallback(() => {
    const { includes = [], tiers = [], types = [], extraTypes = [], search, includeScaledUp, sort = 'popularity' } = filters;
    const singleTier = tiers.length === 1 ? tiers[0] : null;
    const useScaledUp = includeScaledUp && singleTier != null;
    const isAll = includes.length === 0;
    return {
      includeMine: isAll || includes.includes('own'),
      includeSrd: isAll || includes.includes('srd'),
      includePublic: isAll || includes.includes('public'),
      includeHod: isAll || includes.includes('hod'),
      search: search || '',
      tier: singleTier,
      tiers,
      type: types.length === 1 ? types[0] : null,
      types,
      extraTypes,
      includeScaledUp: useScaledUp,
      sort,
    };
  }, [filters]);

  const applyScaled = useCallback((items, loadOpts) => {
    if (collection !== 'adversaries' || !loadOpts.includeScaledUp) return items;
    const singleTier = loadOpts.tier ?? loadOpts.tiers?.[0];
    if (singleTier == null) return items;
    return items.map(item => {
      const itemTier = item.tier ?? 1;
      if (itemTier >= singleTier) return item;
      const role = item.role || 'standard';
      if (!ROLE_STAT_SCALING[role]) return item;
      const scaled = computeScaledStats(item, role, itemTier, singleTier);
      return { ...item, ...scaled, tier: singleTier, _scaledFromTier: itemTier };
    });
  }, [collection]);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setTotalCount(0);
      return;
    }

    const appendMode = infinite && isLoadingMoreRef.current;

    const doFetch = async () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      setLoading(true);
      try {
        const loadOpts = { ...getLoadOpts(), offset, limit };
        const result = await loadCollection(collection, loadOpts);
        const rawItems = result.items || [];
        const scaled = applyScaled(rawItems, loadOpts);

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
      } catch (err) {
        if (err.name !== 'AbortError') console.error(`useCollectionSearch(${collection}) failed:`, err);
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
        isLoadingMoreRef.current = false;
      }
    };

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(doFetch, filters.search ? debounceMs : 0);
    return () => {
      clearTimeout(debounceRef.current);
      abortControllerRef.current?.abort();
    };
  }, [filters, offset, collection, limit, enabled, debounceMs, refreshKey, infinite, maxItems]);

  const setFilter = (key, value) => {
    setFiltersState(prev => {
      let next = { ...prev };
      if (key === 'tier') {
        if (value == null) next = { ...next, tiers: [] };
        else {
          const tiers = next.tiers || [];
          const has = tiers.includes(value);
          next.tiers = has ? tiers.filter(t => t !== value) : [...tiers, value].sort((a, b) => a - b);
        }
      } else if (key === 'type') {
        if (value == null) next = { ...next, types: [] };
        else {
          const types = next.types || [];
          const has = types.includes(value);
          next.types = has ? types.filter(t => t !== value) : [...types, value];
        }
      } else if (key === 'extraType') {
        if (value == null) next = { ...next, extraTypes: [] };
        else {
          const extraTypes = next.extraTypes || [];
          const has = extraTypes.includes(value);
          next.extraTypes = has ? extraTypes.filter(t => t !== value) : [...extraTypes, value];
        }
      } else if (key === 'include') {
        if (value == null) next = { ...next, includes: [] };
        else {
          const includes = (next.includes ?? []).filter(s => s !== 'reddit');
          const has = includes.includes(value);
          next.includes = has ? includes.filter(s => s !== value) : [...includes, value];
        }
      } else if (key === 'includes') {
        next = { ...next, includes: normalizePersistedIncludes(value) ?? [] };
      } else {
        next[key] = value;
      }
      if (key === 'search' && sharedSearchKey) {
        try { localStorage.setItem(sharedSearchKey, typeof value === 'string' ? value : ''); } catch {}
      }
      if ((key === 'include' || key === 'includes') && sharedIncludesKey) {
        try { localStorage.setItem(sharedIncludesKey, JSON.stringify(next.includes ?? [])); } catch {}
      }
      if (persistKey) {
        const toSave = { ...next };
        if (sharedSearchKey) delete toSave.search;
        if (sharedIncludesKey) delete toSave.includes;
        try { localStorage.setItem(`${persistKey}_${collection}`, JSON.stringify(toSave)); } catch {}
      }
      return next;
    });
    setOffsetState(0);
    setIsLoadingMore(false);
    isLoadingMoreRef.current = false;
    setTrimmedCount(0);
    setItems([]);
    setLoading(true);
  };

  const setOffset = (newOffset) => setOffsetState(newOffset);
  const refresh = () => setRefreshKey(k => k + 1);

  const patchItems = (patchMap) => {
    setItems(prev => prev.map(item => patchMap[item.id] ? { ...item, ...patchMap[item.id] } : item));
  };

  const hasMore = infinite ? (items.length + trimmedCount < totalCount) : false;

  const loadMore = () => {
    if (!infinite || !hasMore || loading || isLoadingMore) return;
    const next = nextOffset ?? offset + limit;
    setIsLoadingMore(true);
    isLoadingMoreRef.current = true;
    setOffsetState(next);
  };

  return {
    items,
    totalCount,
    nextOffset,
    loading,
    filters,
    setFilter,
    offset,
    setOffset,
    refresh,
    patchItems,
    hasMore,
    isLoadingMore,
    loadMore,
    trimmedCount,
    getLoadOpts,
  };
}
