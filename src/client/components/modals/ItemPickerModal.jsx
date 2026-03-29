import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { X, AlertTriangle, UserPlus, ChevronDown, ChevronRight, Swords, Trees } from 'lucide-react';
import { CollectionFilters } from '../CollectionFilters.jsx';
import { useCollectionSearch } from '../../lib/useCollectionSearch.js';
import { DaggerstackImport } from '../DaggerstackImport.jsx';
import { saveItem, conceptAiEnabled } from '../../lib/api.js';
import { useAiUiPreference } from '../../lib/ai-ui-preference-context.jsx';
import { shouldShowConceptAiUi } from '../../lib/ai-ui-visibility.js';
import { AiDismissBuildWithAiLink } from '../AiDismissBuildWithAiLink.jsx';
import { generateId } from '../../lib/helpers.js';
import { isCharacterComplete } from '../../lib/character-calc.js';
import { TIERS, ENV_TYPES } from '../../lib/constants.js';
import { CustomSelect } from '../forms/CustomSelect.jsx';
import { RoleSelect } from '../forms/RoleSelect.jsx';
import { handleAiConceptTextareaKeyDown } from '../../lib/ai-concept-textarea.js';

export const ITEM_PICKER_SINGULAR = {
  adversaries: 'Adversary',
  environments: 'Environment',
  scenes: 'Scene',
  adventures: 'Adventure',
  characters: 'Character',
};

const ENV_TYPE_LABEL = {
  traversal: 'Traversal',
  exploration: 'Exploration',
  social: 'Social',
  event: 'Event',
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
 *   onCreateNew   — optional; creates a new library entry and adds to table (Game Table)
 *   onCharacterAiConceptSubmit — optional (characters); opens editor + runs AI with concept
 *   onAdversaryAiConceptSubmit — optional (adversaries); (concept, tier, role)
 *   onEnvironmentAiConceptSubmit — optional (environments); (concept, tier, type)
 *   showDaggerstackImport — when true (default) and collection === 'characters', show the collapsible Daggerstack import block (Game Table passes false).
 */
export function ItemPickerModal({
  collection,
  data = {},
  title,
  initialSearch,
  onClose,
  onSelect,
  onCreateNew,
  onCharacterAiConceptSubmit,
  onAdversaryAiConceptSubmit,
  onEnvironmentAiConceptSubmit,
  isLoading,
  excludeIds,
  showDaggerstackImport = true,
}) {
  const { hideAiUi } = useAiUiPreference();
  const showConceptAiUi = shouldShowConceptAiUi(conceptAiEnabled, hideAiUi);
  const isPaginated = collection === 'adversaries' || collection === 'environments';
  const showNonPaginatedLoading = !isPaginated && isLoading;
  const singular = ITEM_PICKER_SINGULAR[collection] || collection;
  const actionLabel = title || `Add ${singular}`;

  const [pickerSubMode, setPickerSubMode] = useState('browse');
  const [charAiConcept, setCharAiConcept] = useState('');
  const [advAiTier, setAdvAiTier] = useState(1);
  const [advAiRole, setAdvAiRole] = useState('standard');
  const [advAiConcept, setAdvAiConcept] = useState('');
  const [envAiTier, setEnvAiTier] = useState(1);
  const [envAiType, setEnvAiType] = useState('exploration');
  const [envAiConcept, setEnvAiConcept] = useState('');

  useEffect(() => {
    setPickerSubMode('browse');
    setCharAiConcept('');
    setAdvAiConcept('');
    setEnvAiConcept('');
  }, [collection]);

  // Add Adversary / Add Environment dialogs default to Mine + SRD (not just Mine).
  const pickerDefaultFilters = isPaginated ? { defaultFilters: { includes: ['own', 'srd'] } } : {};
  const search = useCollectionSearch(collection, { limit: 40, enabled: isPaginated, infinite: true, ...pickerDefaultFilters });
  const resultsRef = useRef(null);
  const sentinelRef = useRef(null);
  const [daggerstackOpen, setDaggerstackOpen] = useState(false);

  const showBrowse =
    !showConceptAiUi ||
    pickerSubMode === 'browse' ||
    (collection !== 'characters' && collection !== 'adversaries' && collection !== 'environments');

  const showAiPanel =
    showConceptAiUi &&
    pickerSubMode === 'ai' &&
    (collection === 'characters' || collection === 'adversaries' || collection === 'environments');

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

  const browseAiToggle = useCallback(
    (mode) => (
      <div className="flex rounded-lg border border-dh-border overflow-hidden">
        <button
          type="button"
          onClick={() => setPickerSubMode('browse')}
          className={`flex-1 py-2 text-xs font-semibold transition-colors ${
            mode === 'browse' ? 'bg-violet-900/50 text-violet-100' : 'bg-dh-raised text-dh-muted hover:text-dh'
          }`}
        >
          Browse library
        </button>
        <button
          type="button"
          onClick={() => setPickerSubMode('ai')}
          className={`flex-1 py-2 text-xs font-semibold transition-colors border-l border-dh-border ${
            mode === 'ai' ? 'bg-violet-900/50 text-violet-100' : 'bg-dh-raised text-dh-muted hover:text-dh'
          }`}
        >
          Build with AI
        </button>
      </div>
    ),
    [],
  );

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-start justify-center pt-24 p-4" onClick={onClose}>
      <div
        className="bg-dh-surface border border-dh-border rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[75vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dh-border shrink-0">
          <div className="flex items-baseline gap-3">
            <h2 className="font-bold text-white text-lg">{actionLabel}</h2>
            {isPaginated && showBrowse && !search.loading && search.totalCount > 0 && (
              <span className="text-xs text-dh-muted">
                {search.items.length} of {search.totalCount.toLocaleString()}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-dh-muted hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {collection === 'characters' && onCreateNew && (
          <div className="px-5 py-3 border-b border-dh-border shrink-0">
            <button
              type="button"
              onClick={() => {
                onCreateNew();
                onClose();
              }}
              className="w-full rounded-lg border-2 border-sky-500 bg-sky-600 hover:bg-sky-500 text-white font-semibold py-3 px-4 flex items-center justify-center gap-2 transition-colors"
            >
              <UserPlus size={18} />
              Create new character
            </button>
          </div>
        )}

        {collection === 'adversaries' && onCreateNew && (
          <div className="px-5 py-3 border-b border-dh-border shrink-0">
            <button
              type="button"
              onClick={() => {
                onCreateNew();
                onClose();
              }}
              className="w-full rounded-lg border-2 border-amber-600 bg-amber-700 hover:bg-amber-600 text-white font-semibold py-3 px-4 flex items-center justify-center gap-2 transition-colors"
            >
              <Swords size={18} />
              Create new adversary
            </button>
          </div>
        )}

        {collection === 'environments' && onCreateNew && (
          <div className="px-5 py-3 border-b border-dh-border shrink-0">
            <button
              type="button"
              onClick={() => {
                onCreateNew();
                onClose();
              }}
              className="w-full rounded-lg border-2 border-emerald-600 bg-emerald-800 hover:bg-emerald-700 text-white font-semibold py-3 px-4 flex items-center justify-center gap-2 transition-colors"
            >
              <Trees size={18} />
              Create new environment
            </button>
          </div>
        )}

        {collection === 'characters' && onCreateNew && showConceptAiUi && onCharacterAiConceptSubmit && (
          <div className="px-5 py-3 border-b border-dh-border shrink-0 space-y-2">
            {browseAiToggle(pickerSubMode)}
            {showAiPanel && (
              <div className="space-y-2 pt-1">
                <textarea
                  value={charAiConcept}
                  onChange={(e) => setCharAiConcept(e.target.value)}
                  onKeyDown={(e) =>
                    handleAiConceptTextareaKeyDown(e, {
                      canSubmit: !!charAiConcept.trim(),
                      onSubmit: () => {
                        const q = charAiConcept.trim();
                        if (!q) return;
                        onCharacterAiConceptSubmit(q);
                        onClose();
                      },
                    })
                  }
                  rows={3}
                  className="w-full bg-dh-raised border border-dh-border rounded px-2 py-1.5 text-sm text-dh focus:border-violet-500 focus:outline-none resize-y"
                  placeholder="Describe a character concept…"
                />
                <button
                  type="button"
                  onClick={() => {
                    const q = charAiConcept.trim();
                    if (!q) return;
                    onCharacterAiConceptSubmit(q);
                    onClose();
                  }}
                  disabled={!charAiConcept.trim()}
                  className="w-full py-2 rounded-md text-sm font-medium border border-violet-700/60 bg-violet-900/50 text-violet-100 hover:bg-violet-800/60 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Build with AI
                </button>
                <AiDismissBuildWithAiLink className="block w-full pt-0.5" />
              </div>
            )}
          </div>
        )}

        {collection === 'adversaries' && onCreateNew && showConceptAiUi && onAdversaryAiConceptSubmit && (
          <div className="px-5 py-3 border-b border-dh-border shrink-0 space-y-2">
            {browseAiToggle(pickerSubMode)}
            {showAiPanel && (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-dh-muted block mb-0.5">Tier</span>
                    <CustomSelect
                      value={advAiTier}
                      onChange={setAdvAiTier}
                      options={TIERS}
                      getOptionLabel={(t) => String(t)}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-dh-muted block mb-0.5">Role</span>
                    <RoleSelect value={advAiRole} onChange={setAdvAiRole} className="w-full" />
                  </div>
                </div>
                <textarea
                  value={advAiConcept}
                  onChange={(e) => setAdvAiConcept(e.target.value)}
                  onKeyDown={(e) =>
                    handleAiConceptTextareaKeyDown(e, {
                      canSubmit: !!advAiConcept.trim(),
                      onSubmit: () => {
                        const q = advAiConcept.trim();
                        if (!q) return;
                        onAdversaryAiConceptSubmit(q, advAiTier, advAiRole);
                        onClose();
                      },
                    })
                  }
                  rows={3}
                  className="w-full bg-dh-raised border border-dh-border rounded px-2 py-1.5 text-sm text-dh focus:border-violet-500 focus:outline-none resize-y"
                  placeholder="Describe an adversary concept…"
                />
                <button
                  type="button"
                  onClick={() => {
                    const q = advAiConcept.trim();
                    if (!q) return;
                    onAdversaryAiConceptSubmit(q, advAiTier, advAiRole);
                    onClose();
                  }}
                  disabled={!advAiConcept.trim()}
                  className="w-full py-2 rounded-md text-sm font-medium border border-violet-700/60 bg-violet-900/50 text-violet-100 hover:bg-violet-800/60 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Build with AI
                </button>
                <AiDismissBuildWithAiLink className="block w-full pt-0.5" />
              </div>
            )}
          </div>
        )}

        {collection === 'environments' && onCreateNew && showConceptAiUi && onEnvironmentAiConceptSubmit && (
          <div className="px-5 py-3 border-b border-dh-border shrink-0 space-y-2">
            {browseAiToggle(pickerSubMode)}
            {showAiPanel && (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-dh-muted block mb-0.5">Tier</span>
                    <CustomSelect
                      value={envAiTier}
                      onChange={setEnvAiTier}
                      options={TIERS}
                      getOptionLabel={(t) => String(t)}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-dh-muted block mb-0.5">Type</span>
                    <CustomSelect
                      value={envAiType}
                      onChange={setEnvAiType}
                      options={ENV_TYPES}
                      getOptionLabel={(t) => ENV_TYPE_LABEL[t] ?? t}
                      className="w-full"
                    />
                  </div>
                </div>
                <textarea
                  value={envAiConcept}
                  onChange={(e) => setEnvAiConcept(e.target.value)}
                  onKeyDown={(e) =>
                    handleAiConceptTextareaKeyDown(e, {
                      canSubmit: !!envAiConcept.trim(),
                      onSubmit: () => {
                        const q = envAiConcept.trim();
                        if (!q) return;
                        onEnvironmentAiConceptSubmit(q, envAiTier, envAiType);
                        onClose();
                      },
                    })
                  }
                  rows={3}
                  className="w-full bg-dh-raised border border-dh-border rounded px-2 py-1.5 text-sm text-dh focus:border-violet-500 focus:outline-none resize-y"
                  placeholder="Describe an environment concept…"
                />
                <button
                  type="button"
                  onClick={() => {
                    const q = envAiConcept.trim();
                    if (!q) return;
                    onEnvironmentAiConceptSubmit(q, envAiTier, envAiType);
                    onClose();
                  }}
                  disabled={!envAiConcept.trim()}
                  className="w-full py-2 rounded-md text-sm font-medium border border-violet-700/60 bg-violet-900/50 text-violet-100 hover:bg-violet-800/60 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Build with AI
                </button>
                <AiDismissBuildWithAiLink className="block w-full pt-0.5" />
              </div>
            )}
          </div>
        )}

        {/* Daggerstack import — only for characters; collapsible, collapsed by default; right under Create. Hidden on Game Table Add Character via showDaggerstackImport={false}. */}
        {collection === 'characters' && showBrowse && showDaggerstackImport && (
          <div className="border-b border-dh-border shrink-0">
            <button
              type="button"
              onClick={() => setDaggerstackOpen(prev => !prev)}
              className="w-full px-5 py-2.5 flex items-center gap-2 text-left text-dh hover:text-white hover:bg-dh-raised/50 transition-colors"
            >
              {daggerstackOpen ? <ChevronDown size={16} className="shrink-0" /> : <ChevronRight size={16} className="shrink-0" />}
              <span className="text-sm font-medium">Import from Daggerstack</span>
            </button>
            {daggerstackOpen && (
              <div className="px-5 pb-3 pt-0 shrink-0">
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
          </div>
        )}

        {/* Filters — only for paginated collections (adversaries / environments) */}
        {isPaginated && showBrowse && (
          <div className="px-5 py-4 border-b border-dh-border shrink-0">
            <CollectionFilters
              collection={collection}
              filters={search.filters}
              onFilterChange={search.setFilter}
              variant="panel"
              autoFocusSearch
            />
          </div>
        )}

        {/* Simple search for non-paginated (scenes / adventures / characters) */}
        {!isPaginated && showBrowse && (
          <div className="px-5 py-3 border-b border-dh-border shrink-0">
            <div className="flex items-center gap-2 bg-dh-raised border border-dh-border rounded-lg px-3 py-2 focus-within:border-blue-500 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-dh-muted shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input
                autoFocus={collection !== 'characters'}
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder-dh-muted"
                placeholder="Search by name..."
                value={search.filters.search}
                onChange={e => search.setFilter('search', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Results */}
        {showBrowse && (
        <div ref={resultsRef} className="flex-1 overflow-y-auto min-h-0">
          {(search.loading || showNonPaginatedLoading) && !search.isLoadingMore && (
            <div className="text-center text-dh-muted text-sm py-10">Loading…</div>
          )}
          {!search.loading && !showNonPaginatedLoading && clientItems.length === 0 && (
            <div className="text-center text-dh-muted text-sm py-10">No results</div>
          )}
          {clientItems.map(item => {
            const charCheck = collection === 'characters' ? isCharacterComplete(item) : null;
            const incomplete = charCheck && !charCheck.complete;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelect(item);
                  onClose();
                }}
                className={`w-full text-left px-5 py-3 border-b border-dh-border/50 transition-colors flex items-baseline justify-between gap-4 hover:bg-dh-hover`}
                title={incomplete ? `Incomplete — missing: ${charCheck.missing.join(', ')}` : undefined}
              >
                <span className="font-medium text-sm truncate text-white">{item.name}</span>
                <span className="text-xs text-dh-muted shrink-0 flex items-center gap-1.5">
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
            <div className="text-center text-dh-muted text-xs py-3 animate-pulse">
              Loading more of the {search.totalCount.toLocaleString()} entries…
            </div>
          )}
          {!search.hasMore && !search.loading && search.totalCount > 0 && (
            <div className="text-center text-dh-muted text-xs py-3">
              Loaded last of {search.totalCount.toLocaleString()} entries
            </div>
          )}
          {search.hasMore && !search.isLoadingMore && <div style={{ height: 200 }} />}
          <div ref={sentinelRef} className="h-1" />
        </div>
        )}
      </div>
    </div>
  );
}
