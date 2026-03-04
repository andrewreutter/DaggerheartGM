import { useEffect, useRef } from 'react';
import { Sparkles, Plus } from 'lucide-react';
import { generateId } from '../../lib/helpers.js';
import { useCollectionSearch } from '../../lib/useCollectionSearch.js';
import { CollectionFilters } from '../CollectionFilters.jsx';
import { SOURCE_BADGE, SOURCE_ORDER } from '../../lib/constants.js';

function buildKey(exp) {
  return (exp.name || '').trim().toLowerCase();
}

/**
 * Experience Library sidebar panel.
 * Self-fetches adversary items via useCollectionSearch and extracts experiences.
 *
 * Props:
 *   tier               - current form tier (synced into filter as a default)
 *   subtype            - current form role value
 *   currentExperiences - experiences already on the form (excluded from suggestions)
 *   onAdd              - callback(experience) when user clicks an experience to add
 */
export function ExperienceLibrary({ tier, subtype, currentExperiences, onAdd }) {
  const search = useCollectionSearch('adversaries', {
    limit: 500,
    debounceMs: 400,
    infinite: true,
    persistKey: 'dh_experienceLibraryFilters',
    defaultFilters: { include: 'srd' },
  });

  const listRef = useRef(null);
  const sentinelRef = useRef(null);

  // Follow form changes — sync tier and role into the hook's filter state.
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

  // Extract, deduplicate, and prioritise experiences from the current page of items.
  const currentKeys = new Set((currentExperiences || []).map(buildKey));
  const candidateMap = new Map();

  (search.items || []).forEach(item => {
    (item.experiences || []).forEach(exp => {
      const key = buildKey(exp);
      if (currentKeys.has(key)) return;
      const existing = candidateMap.get(key);
      const src = item._source || 'own';
      if (!existing || (SOURCE_ORDER[src] ?? 99) < (SOURCE_ORDER[existing.source] ?? 99)) {
        candidateMap.set(key, { experience: exp, source: src, sourceName: item.name });
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
          <Sparkles size={15} className="text-amber-400" /> Experience Library
          {search.totalCount > 0 && (
            <span className="text-[10px] text-slate-500 font-normal ml-1 normal-case tracking-normal">
              {search.items.length} of {search.totalCount} items
            </span>
          )}
        </h4>
        <CollectionFilters
          collection="adversaries"
          filters={search.filters}
          onFilterChange={search.setFilter}
          variant="panel"
        />
        {search.loading && !search.isLoadingMore && (
          <p className="text-[10px] text-slate-500 mt-2 animate-pulse">Loading…</p>
        )}
      </div>

      {/* Scrollable experience list */}
      <div ref={listRef} className="p-3 space-y-2 overflow-y-auto flex-1">
        {!search.loading && candidates.length === 0 && (
          <p className="text-xs text-slate-500 italic mt-2">
            No experiences found for the selected filter.
          </p>
        )}

        {candidates.map(({ key, experience, source, sourceName }) => (
          <ExperienceCard
            key={key}
            experience={experience}
            source={source}
            sourceName={sourceName}
            onAdd={onAdd}
            showSourceBadge
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

function ExperienceCard({ experience, source, sourceName, onAdd, showSourceBadge }) {
  return (
    <button
      type="button"
      onClick={() => onAdd({ ...experience, modifier: 2, id: generateId() })}
      className="w-full text-left bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 p-2.5 rounded transition-colors"
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {showSourceBadge && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${SOURCE_BADGE[source]?.className || 'bg-slate-700 text-slate-300'}`}>
              {SOURCE_BADGE[source]?.label ?? source}
            </span>
          )}
          <span className="font-medium text-slate-200 text-xs leading-tight truncate">{experience.name || '(unnamed)'}</span>
        </div>
        <Plus size={12} className="text-slate-500 group-hover:text-green-400 shrink-0 mt-0.5 transition-colors" />
      </div>
      {sourceName && (
        <p className="text-[10px] text-slate-500 mt-1.5">
          From: {sourceName}
        </p>
      )}
    </button>
  );
}
