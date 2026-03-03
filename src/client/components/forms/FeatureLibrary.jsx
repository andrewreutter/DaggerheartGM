import { useEffect, useRef, useState } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import { generateId } from '../../lib/helpers.js';
import { useCollectionSearch } from '../../lib/useCollectionSearch.js';
import { CollectionFilters } from '../CollectionFilters.jsx';
import { SOURCE_BADGE, SOURCE_ORDER } from '../../lib/constants.js';

const TYPE_BADGE = {
  action: 'bg-amber-900/60 text-amber-300',
  reaction: 'bg-teal-900/60 text-teal-300',
  passive: 'bg-slate-700/80 text-slate-300',
};

function buildKey(feature) {
  return `${(feature.name || '').trim().toLowerCase()}|${feature.type}|${(feature.description || '').trim()}`;
}

/**
 * Feature Library sidebar panel.
 * Self-fetches its own items via useCollectionSearch — no `items` prop needed.
 *
 * Props:
 *   tier            - current form tier (synced into filter as a default)
 *   subtype         - current form role/type value
 *   subtypeKey      - 'role' | 'type'
 *   currentFeatures - features already on the form (excluded from suggestions)
 *   onAdd           - callback(feature) when user clicks a feature to add
 */
export function FeatureLibrary({ tier, subtype, subtypeKey, currentFeatures, onAdd }) {
  const collection = subtypeKey === 'role' ? 'adversaries' : 'environments';

  const search = useCollectionSearch(collection, {
    limit: 500,
    debounceMs: 400,
    infinite: true,
  });

  const listRef = useRef(null);
  const sentinelRef = useRef(null);

  // Follow form changes — sync tier and subtype into the hook's filter state.
  useEffect(() => { search.setFilter('tier', tier ?? null); }, [tier]);
  useEffect(() => { search.setFilter('type', subtype ?? null); }, [subtype]);

  // IntersectionObserver to trigger loadMore when sentinel enters view
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = listRef.current;
    if (!sentinel || !container || !search.hasMore || search.isLoadingMore) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) search.loadMore(); },
      { root: container, rootMargin: '150px' }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [search.hasMore, search.isLoadingMore, search.loadMore]);

  // Extract, deduplicate, and prioritise features from the current page of items.
  const currentKeys = new Set((currentFeatures || []).map(buildKey));
  const candidateMap = new Map();

  (search.items || []).forEach(item => {
    (item.features || []).forEach(feat => {
      const key = buildKey(feat);
      if (currentKeys.has(key)) return;
      const existing = candidateMap.get(key);
      const src = item._source || 'own';
      if (!existing || (SOURCE_ORDER[src] ?? 99) < (SOURCE_ORDER[existing.source] ?? 99)) {
        candidateMap.set(key, { feature: feat, source: src, sourceName: item.name });
      }
    });
  });

  const candidates = Array.from(candidateMap.entries())
    .sort(([, a], [, b]) => SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source])
    .map(([key, val]) => ({ key, ...val }));

  return (
    <div className="h-full bg-slate-900 border border-slate-700 rounded-xl flex flex-col overflow-hidden">
      {/* Header with filters */}
      <div className="p-3 bg-slate-950 border-b border-slate-800 shrink-0">
        <h4 className="font-bold text-white uppercase tracking-wider text-sm flex items-center gap-2 mb-3">
          <BookOpen size={15} className="text-blue-400" /> Feature Library
          {search.totalCount > 0 && (
            <span className="text-[10px] text-slate-500 font-normal ml-1 normal-case tracking-normal">
              {search.items.length} of {search.totalCount} items
            </span>
          )}
        </h4>
        <CollectionFilters
          collection={collection}
          filters={search.filters}
          onFilterChange={search.setFilter}
          variant="panel"
        />
        {search.loading && !search.isLoadingMore && (
          <p className="text-[10px] text-slate-500 mt-2 animate-pulse">Loading…</p>
        )}
      </div>

      {/* Scrollable feature list */}
      <div ref={listRef} className="p-3 space-y-2 overflow-y-auto flex-1">
        {!search.loading && candidates.length === 0 && (
          <p className="text-xs text-slate-500 italic mt-2">
            No features found for the selected filter.
          </p>
        )}

        {candidates.map(({ key, feature, source, sourceName }) => (
          <FeatureCard
            key={key}
            feature={feature}
            source={source}
            sourceName={sourceName}
            onAdd={onAdd}
          />
        ))}

        {search.isLoadingMore && (
          <div className="text-center text-slate-500 text-[10px] py-2 animate-pulse">
            Loading more of the {search.totalCount.toLocaleString()} items…
          </div>
        )}
        {!search.hasMore && !search.loading && search.totalCount > 0 && (
          <div className="text-center text-slate-500 text-[10px] py-2">
            Loaded last of {search.totalCount.toLocaleString()} items
          </div>
        )}
        {/* One-page spacer + sentinel for infinite scroll trigger */}
        {search.hasMore && !search.isLoadingMore && <div style={{ height: 200 }} />}
        <div ref={sentinelRef} className="h-1" />
      </div>
    </div>
  );
}

function FeatureCard({ feature, source, sourceName, onAdd }) {
  const [hoverTop, setHoverTop] = useState(null);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onAdd({ ...feature, id: generateId() })}
        onMouseEnter={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          setHoverTop(Math.max(8, Math.min(rect.top, window.innerHeight - 300)));
        }}
        onMouseLeave={() => setHoverTop(null)}
        className="w-full text-left bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 p-2.5 rounded transition-colors"
      >
        <div className="flex items-start justify-between gap-1 mb-1">
          <span className="font-medium text-slate-200 text-xs leading-tight">{feature.name || '(unnamed)'}</span>
          <Plus size={12} className="text-slate-500 group-hover:text-green-400 shrink-0 mt-0.5 transition-colors" />
        </div>
        <div className="flex flex-wrap gap-1 mb-1.5">
          {feature.type && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${TYPE_BADGE[feature.type] || 'bg-slate-700 text-slate-300'}`}>
              {feature.type}
            </span>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${SOURCE_BADGE[source]?.className || 'bg-slate-700 text-slate-300'}`}>
            {SOURCE_BADGE[source]?.label ?? source}
          </span>
        </div>
        <p className="text-xs text-slate-400 line-clamp-2 leading-snug">{feature.description}</p>
      </button>

      {/* Fixed-position popover to avoid overflow clipping */}
      {hoverTop !== null && (
        <div
          className="fixed z-[60] pointer-events-none"
          style={{ right: 'calc(18rem + 12px)', top: hoverTop, width: '22rem' }}
        >
          <div className="bg-slate-900 border border-slate-600 rounded-xl shadow-2xl p-4 max-h-72 overflow-y-auto">
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="font-bold text-white text-sm leading-tight">{feature.name || '(unnamed)'}</span>
              <div className="flex flex-wrap gap-1 shrink-0">
                {feature.type && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${TYPE_BADGE[feature.type] || ''}`}>
                    {feature.type}
                  </span>
                )}
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${SOURCE_BADGE[source]?.className || ''}`}>
                  {SOURCE_BADGE[source]?.label ?? source}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{feature.description}</p>
            {sourceName && (
              <p className="text-[10px] text-slate-500 mt-2 border-t border-slate-700 pt-2">
                From: {sourceName}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
