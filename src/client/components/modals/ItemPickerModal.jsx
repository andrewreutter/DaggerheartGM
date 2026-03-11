import { useMemo, useEffect, useRef } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { CollectionFilters } from '../CollectionFilters.jsx';
import { useCollectionSearch } from '../../lib/useCollectionSearch.js';
import { DaggerstackImport } from '../DaggerstackImport.jsx';
import { saveItem } from '../../lib/api.js';
import { generateId } from '../../lib/helpers.js';
import { isCharacterComplete } from '../../lib/character-calc.js';

export const ITEM_PICKER_SINGULAR = {
  adversaries: 'Adversary',
  environments: 'Environment',
  scenes: 'Scene',
  adventures: 'Adventure',
  characters: 'Character',
};

/**
 * A searchable, filterable item picker modal.
 *
 * For adversaries/environments: uses useCollectionSearch with full filters + infinite scroll.
 * For scenes/adventures: uses a simple client-side name search over `data[collection]`.
 *
 * Props:
   *   collection    — which collection to browse ('adversaries' | 'environments' | 'scenes' | 'adventures')
 *   data          — { [collection]: item[] } used for non-paginated collections
 *   title         — optional override for the modal header (default: "Add <Singular>")
 *   initialSearch — pre-fill the search input on open (useful for "Link placeholder" flow)
 *   onClose       — called when the modal is dismissed
 *   onSelect      — called with the selected item; modal closes itself after
 */
export function ItemPickerModal({ collection, data = {}, title, initialSearch, onClose, onSelect, isLoading, excludeIds }) {
  const isPaginated = collection === 'adversaries' || collection === 'environments';
  const showNonPaginatedLoading = !isPaginated && isLoading;
  const singular = ITEM_PICKER_SINGULAR[collection] || collection;
  const actionLabel = title || `Add ${singular}`;

  const search = useCollectionSearch(collection, { limit: 40, enabled: isPaginated, infinite: true });
  const resultsRef = useRef(null);
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (initialSearch) search.setFilter('search', initialSearch);
  // Run only once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const excludeSet = useMemo(() => new Set(excludeIds || []), [excludeIds]);

  const clientItems = useMemo(() => {
    if (isPaginated) return excludeSet.size ? search.items.filter(item => !excludeSet.has(item.id)) : search.items;
    const list = data[collection] || [];
    const lowerSearch = search.filters.search.trim().toLowerCase();
    const filtered = lowerSearch ? list.filter(item => item.name?.toLowerCase().includes(lowerSearch)) : list;
    return excludeSet.size ? filtered.filter(item => !excludeSet.has(item.id)) : filtered;
  }, [isPaginated, search.items, search.filters.search, data, collection, excludeSet]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [onClose]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = resultsRef.current;
    if (!sentinel || !container || !search.hasMore || search.isLoadingMore) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) search.loadMore(); },
      { root: container, rootMargin: '150px' }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [search.hasMore, search.isLoadingMore, search.loadMore]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-start justify-center pt-16 p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[75vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-baseline gap-3">
            <h2 className="font-bold text-white text-lg">{actionLabel}</h2>
            {isPaginated && !search.loading && search.totalCount > 0 && (
              <span className="text-xs text-slate-500">
                {search.items.length} of {search.totalCount.toLocaleString()}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Filters — only for paginated collections (adversaries / environments) */}
        {isPaginated && (
          <div className="px-5 py-4 border-b border-slate-800 shrink-0">
            <CollectionFilters
              collection={collection}
              filters={search.filters}
              onFilterChange={search.setFilter}
              variant="panel"
              autoFocusSearch
            />
          </div>
        )}

        {/* Simple search for non-paginated (scenes / adventures) */}
        {!isPaginated && (
          <div className="px-5 py-3 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 focus-within:border-blue-500 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input
                autoFocus
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder-slate-500"
                placeholder="Search by name..."
                value={search.filters.search}
                onChange={e => search.setFilter('search', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Daggerstack import — only for characters */}
        {collection === 'characters' && (
          <div className="px-5 py-3 border-b border-slate-800 shrink-0">
            <DaggerstackImport
              compact
              onImported={async (character) => {
                const charToSave = { ...character, id: generateId() };
                delete charToSave.elementType;
                delete charToSave.conditions;
                delete charToSave.playerName;
                const saved = await saveItem('characters', charToSave);
                if (saved) {
                  onSelect(saved);
                  onClose();
                }
              }}
            />
          </div>
        )}

        {/* Results */}
        <div ref={resultsRef} className="flex-1 overflow-y-auto min-h-0">
          {(search.loading || showNonPaginatedLoading) && !search.isLoadingMore && (
            <div className="text-center text-slate-500 text-sm py-10">Loading…</div>
          )}
          {!search.loading && !showNonPaginatedLoading && clientItems.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-10">No results</div>
          )}
          {clientItems.map(item => {
            const charCheck = collection === 'characters' ? isCharacterComplete(item) : null;
            const incomplete = charCheck && !charCheck.complete;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (incomplete) return;
                  onSelect(item); onClose();
                }}
                disabled={incomplete}
                className={`w-full text-left px-5 py-3 border-b border-slate-800/50 transition-colors flex items-baseline justify-between gap-4 ${
                  incomplete ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-800'
                }`}
                title={incomplete ? `Incomplete — missing: ${charCheck.missing.join(', ')}. Edit this character first.` : undefined}
              >
                <span className={`font-medium text-sm truncate ${incomplete ? 'text-slate-400' : 'text-white'}`}>{item.name}</span>
                <span className="text-xs text-slate-400 shrink-0 flex items-center gap-1.5">
                  {incomplete && (
                    <span className="flex items-center gap-0.5 text-amber-400" title={`Missing: ${charCheck.missing.join(', ')}`}>
                      <AlertTriangle size={10} />
                      <span className="text-[10px]">Incomplete</span>
                    </span>
                  )}
                  {item.tier != null && <span>Tier {item.tier}</span>}
                  {item.tier != null && (item.role || item.type || item.class) && <span>·</span>}
                  {(item.role || item.type) && <span className="capitalize">{item.role || item.type}</span>}
                  {collection === 'characters' && item.class && <span>{item.class}</span>}
                  {collection === 'characters' && item.level != null && <span>Lvl {item.level}</span>}
                </span>
              </button>
            );
          })}
          {search.isLoadingMore && (
            <div className="text-center text-slate-500 text-xs py-3 animate-pulse">
              Loading more of the {search.totalCount.toLocaleString()} entries…
            </div>
          )}
          {!search.hasMore && !search.loading && search.totalCount > 0 && (
            <div className="text-center text-slate-500 text-xs py-3">
              Loaded last of {search.totalCount.toLocaleString()} entries
            </div>
          )}
          {search.hasMore && !search.isLoadingMore && <div style={{ height: 200 }} />}
          <div ref={sentinelRef} className="h-1" />
        </div>
      </div>
    </div>
  );
}
