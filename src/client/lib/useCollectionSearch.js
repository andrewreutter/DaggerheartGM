import { useState, useEffect, useRef } from 'react';
import { loadCollection } from './api.js';

const DEFAULT_FILTERS = { include: 'own', tier: null, type: null, search: '' };

function loadPersistedFilters(persistKey, collection, baseFilters = DEFAULT_FILTERS) {
  const defaults = { ...DEFAULT_FILTERS, ...baseFilters };
  if (!persistKey) return { ...defaults };
  try {
    const stored = localStorage.getItem(`${persistKey}_${collection}`);
    if (stored) return { ...defaults, ...JSON.parse(stored) };
  } catch {}
  return { ...defaults };
}

/**
 * Shared hook for fetching, filtering, and paginating a single collection.
 *
 * @param {string} collection - e.g. 'adversaries', 'environments'
 * @param {object} opts
 * @param {number}   opts.limit       - Page size (default 20)
 * @param {number}   opts.debounceMs  - Debounce delay for search input (default 300)
 * @param {string}   opts.persistKey   - localStorage key prefix; per-collection suffix is appended
 * @param {object}   opts.defaultFilters - Override default filter values (e.g. { include: 'srd' })
 * @param {boolean}  opts.enabled     - Set false to skip fetching (e.g. non-paginated collections)
 * @param {boolean}  opts.infinite    - When true, items accumulate across pages (infinite scroll mode)
 * @param {number}   opts.maxItems    - When set with infinite:true, trims the oldest items once exceeded
 *
 * @returns {{
 *   items: any[],
 *   totalCount: number,
 *   nextOffset: number|null,
 *   loading: boolean,
 *   filters: { include: string|null, tier: number|null, type: string|null, search: string },
 *   setFilter: (key: string, value: any) => void,
 *   offset: number,
 *   setOffset: (n: number) => void,
 *   refresh: () => void,
 *   hasMore: boolean,
 *   isLoadingMore: boolean,
 *   loadMore: () => void,
 *   trimmedCount: number,
 * }}
 */
export function useCollectionSearch(collection, {
  limit = 20,
  debounceMs = 300,
  persistKey = null,
  defaultFilters = {},
  enabled = true,
  infinite = false,
  maxItems = null,
} = {}) {
  const baseFilters = { ...DEFAULT_FILTERS, ...defaultFilters };
  const [filters, setFiltersState] = useState(() => loadPersistedFilters(persistKey, collection, baseFilters));
  const [offset, setOffsetState] = useState(0);
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [nextOffset, setNextOffsetState] = useState(null);
  const [loading, setLoading] = useState(false);
  // Incrementing this counter forces a refetch without changing other deps.
  const [refreshKey, setRefreshKey] = useState(0);

  // Infinite scroll state
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [trimmedCount, setTrimmedCount] = useState(0);

  const prevCollectionRef = useRef(collection);
  const debounceRef = useRef(null);
  // Ref so doFetch can read the current value without being a dep
  const isLoadingMoreRef = useRef(false);

  // When collection changes (e.g. LibraryView tab switch), reset state and load
  // persisted filters for the new collection.
  useEffect(() => {
    if (prevCollectionRef.current !== collection) {
      prevCollectionRef.current = collection;
      setFiltersState(loadPersistedFilters(persistKey, collection, baseFilters));
      setOffsetState(0);
      setItems([]);
      setTotalCount(0);
      setNextOffsetState(null);
      setIsLoadingMore(false);
      isLoadingMoreRef.current = false;
      setTrimmedCount(0);
    }
  }, [collection, persistKey]);

  // Main fetch effect — debounces only the search field; all other changes are immediate.
  useEffect(() => {
    if (!enabled) { setItems([]); return; }

    const appendMode = infinite && isLoadingMoreRef.current;

    const doFetch = async () => {
      setLoading(true);
      try {
        const { include, tier, type, search } = filters;
        const result = await loadCollection(collection, {
          includeMine: include === null || include === 'own',
          includeSrd: include === null || include === 'srd',
          includePublic: include === null || include === 'public',
          includeHod: include === null || include === 'hod',
          includeFcg: include === null || include === 'fcg',
          // Reddit is intentionally excluded from "All" (include === null) to avoid
          // surfacing unstructured stubs in default results. Only shown on explicit selection.
          includeReddit: include === 'reddit',
          search: search || '',
          tier,
          type,
          offset,
          limit,
        });
        setTotalCount(result.totalCount || 0);
        setNextOffsetState(result.nextOffset ?? null);

        if (appendMode) {
          setItems(prev => {
            const merged = [...prev, ...(result.items || [])];
            if (maxItems && merged.length > maxItems) {
              const excess = merged.length - maxItems;
              setTrimmedCount(tc => tc + excess);
              return merged.slice(excess);
            }
            return merged;
          });
        } else {
          setItems(result.items || []);
          setTrimmedCount(0);
        }
      } catch (err) {
        console.error(`useCollectionSearch(${collection}) failed:`, err);
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
        isLoadingMoreRef.current = false;
      }
    };

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(doFetch, filters.search ? debounceMs : 0);
    return () => clearTimeout(debounceRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, offset, collection, limit, enabled, debounceMs, refreshKey]);

  /** Update one filter key and reset pagination to page 1. */
  const setFilter = (key, value) => {
    setFiltersState(prev => {
      const next = { ...prev, [key]: value };
      if (persistKey) {
        try { localStorage.setItem(`${persistKey}_${collection}`, JSON.stringify(next)); } catch {}
      }
      return next;
    });
    setOffsetState(0);
    setIsLoadingMore(false);
    isLoadingMoreRef.current = false;
    setTrimmedCount(0);
    if (key !== 'search') {
      setItems([]);
      setLoading(true);
    }
  };

  /** Jump to an explicit page offset. */
  const setOffset = (newOffset) => setOffsetState(newOffset);

  /** Force an immediate refetch with the current filters and offset. */
  const refresh = () => setRefreshKey(k => k + 1);

  /** Merge partial item data by ID into the displayed list (e.g. after lazy-loading enrichment). */
  const patchItems = (patchMap) => {
    setItems(prev => prev.map(item => patchMap[item.id] ? { ...item, ...patchMap[item.id] } : item));
  };

  const hasMore = infinite ? (items.length + trimmedCount < totalCount) : false;

  /** Load the next page of results, appending to the current list. */
  const loadMore = () => {
    if (!infinite || !hasMore || loading || isLoadingMore) return;
    const next = nextOffset ?? offset + limit;
    setIsLoadingMore(true);
    isLoadingMoreRef.current = true;
    setOffsetState(next);
  };

  return {
    items, totalCount, nextOffset, loading, filters, setFilter,
    offset, setOffset, refresh, patchItems,
    hasMore, isLoadingMore, loadMore, trimmedCount,
  };
}
