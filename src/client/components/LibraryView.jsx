import { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Map, Play, BookOpen, Plus } from 'lucide-react';
import { ItemCard } from './ItemCard.jsx';
import { RolzImportModal } from './modals/RolzImportModal.jsx';
import { ItemDetailModal } from './modals/ItemDetailModal.jsx';
import { CollectionFilters } from './CollectionFilters.jsx';
import { useCollectionSearch } from '../lib/useCollectionSearch.js';
import { isOwnItem, needsHodEnrich, needsRedditParse } from '../lib/constants.js';
import { enrichItems, enrichSingleItem, parseRedditItem, blockRedditPost } from '../lib/api.js';

const LIBRARY_FILTERS_PERSIST_KEY = 'dh_collectionFilters';

const SINGULAR_NAMES = {
  adversaries: 'Adversary',
  environments: 'Environment',
  scenes: 'Scene',
  adventures: 'Adventure',
};

const TABS = [
  { id: 'adversaries', label: 'Adversaries', Icon: ShieldAlert },
  { id: 'environments', label: 'Environments', Icon: Map },
  { id: 'scenes', label: 'Scenes', Icon: Play },
  { id: 'adventures', label: 'Adventures', Icon: BookOpen },
];

const SRD_FILTER_TABS = new Set(['adversaries', 'environments']);

export function LibraryView({ data, saveItem, deleteItem, cloneItem, addToTable, route, navigate, onItemsChange, isAdmin }) {
  const [showRolzImport, setShowRolzImport] = useState(false);
  // modalState: null | { item: object, isNew: boolean }
  const [modalState, setModalState] = useState(null);

  const activeTab = route.tab || 'adversaries';
  const isPaginatedTab = SRD_FILTER_TABS.has(activeTab);

  const search = useCollectionSearch(activeTab, {
    limit: 20,
    debounceMs: 400,
    persistKey: isPaginatedTab ? LIBRARY_FILTERS_PERSIST_KEY : null,
    enabled: isPaginatedTab,
    infinite: true,
    maxItems: 500,
  });

  // Sync paginated items to app-level data.
  useEffect(() => {
    if (isPaginatedTab && onItemsChange) {
      onItemsChange(activeTab, search.items);
    }
  }, [search.items, activeTab, isPaginatedTab]);

  // Lazy-load tier (and full detail) for HoD adversaries/environments that came back
  // from the list search with tier=null. Fires background Foundry detail fetches,
  // patches the displayed items in place, and warms the mirror cache.
  const enrichAttemptedRef = useRef(new Set());
  useEffect(() => {
    if (!isPaginatedTab) return;
    const needsEnrich = search.items.filter(i =>
      i._source === 'hod' && (i.tier == null || (i.features || []).length === 0) && !enrichAttemptedRef.current.has(i.id)
    );
    if (needsEnrich.length === 0) return;
    needsEnrich.forEach(i => enrichAttemptedRef.current.add(i.id));
    enrichItems(activeTab, needsEnrich).then(enriched => {
      if (Object.keys(enriched).length > 0) search.patchItems(enriched);
    }).catch(() => {});
  }, [search.items, activeTab, isPaginatedTab]);

  // For paginated tabs, items come from the hook; for non-paginated, from app data.
  const items = isPaginatedTab ? search.items : (data[activeTab] || []);

  // Handle deep-link routes: /library/:tab/:id opens the modal.
  const { itemId, action } = route;
  const deepLinkProcessedRef = useRef(false);

  useEffect(() => {
    if (deepLinkProcessedRef.current) return;
    if (!itemId) return;

    if (itemId === 'new') {
      deepLinkProcessedRef.current = true;
      setModalState({ item: {}, isNew: true });
      navigate(`/library/${activeTab}`, { replace: true });
      return;
    }

    // Wait for items to load before resolving the deep link.
    const found = items.find(i => i.id === itemId);
    if (!found && isPaginatedTab && search.loading) return; // still loading
    if (!found && !isPaginatedTab && items.length === 0) return; // not ready yet

    deepLinkProcessedRef.current = true;
    if (found) {
      setModalState({ item: found, isNew: false });
    }
    navigate(`/library/${activeTab}`, { replace: true });
  }, [itemId, items, isPaginatedTab, search.loading, activeTab, navigate, action]);

  // Reset deep-link flag when tab or route changes.
  useEffect(() => {
    deepLinkProcessedRef.current = false;
  }, [activeTab, itemId]);

  const openModal = async (item) => {
    navigate(`/library/${activeTab}/${item.id || 'new'}`);
    if (needsHodEnrich(item)) {
      setModalState({ item, isNew: false, enriching: true });
      const enriched = await enrichSingleItem(activeTab, item);
      search.patchItems({ [enriched.id]: enriched });
      setModalState({ item: enriched, isNew: false, enriching: false });
    } else if (needsRedditParse(item)) {
      setModalState({ item, isNew: false, enriching: true });
      handleParseReddit(item);
    } else {
      setModalState({ item, isNew: !item.id });
    }
  };

  const handleParseReddit = async (item, { forceLlm } = {}) => {
    const cleanItem = { ...item };
    delete cleanItem._redditParseError;
    const alreadyParsed = (item.features || []).length > 0;
    setModalState({ item: cleanItem, isNew: false, enriching: true });
    try {
      const { item: parsed, _parseMethod } = await parseRedditItem(activeTab, item, { forceLlm, reparse: alreadyParsed });
      const merged = { ...item, ...parsed, _parseMethod };
      search.patchItems({ [merged.id]: merged });
      setModalState({ item: merged, isNew: false, enriching: false });
    } catch (err) {
      console.error('[reddit] Parse failed:', err);
      setModalState({ item: { ...item, _redditParseError: err.message }, isNew: false, enriching: false });
    }
  };

  const openNew = () => {
    navigate(`/library/${activeTab}/new`);
    setModalState({ item: {}, isNew: true });
  };

  const closeModal = () => {
    navigate(`/library/${activeTab}`, { replace: true });
    setModalState(null);
  };

  const handleSave = async (formData) => {
    const itemToSave = { ...formData };
    if (modalState?.isNew && !itemToSave.id) {
      // Let the server assign an ID on first save; we don't need to set one here
      // because the server upserts and returns the item.
    }
    await saveItem(activeTab, itemToSave);
    if (isPaginatedTab) search.refresh();
    // Keep modal open after save (auto-save pattern — no explicit "done" step).
  };

  const handleDelete = async (collectionName, id) => {
    await deleteItem(collectionName, id);
    if (isPaginatedTab) search.refresh();
    closeModal();
  };

  const handleClone = async (item) => {
    const cloned = await cloneItem(activeTab, item);
    if (isPaginatedTab) search.refresh();
    closeModal();
    // Open the clone immediately.
    setModalState({ item: cloned, isNew: false });
    navigate(`/library/${activeTab}/${cloned.id}`);
  };

  const handleBlockReddit = async (redditPostId) => {
    if (!redditPostId) return;
    try {
      await blockRedditPost(redditPostId);
      if (isPaginatedTab) search.refresh();
      closeModal();
    } catch (err) {
      console.error('Failed to block Reddit post:', err);
    }
  };

  /**
   * Applies an edited copy of an element back into the parent scene/group data structure,
   * replacing the reference at the given index with an inline owned copy.
   */
  const applyEditedCopyToParent = (element, editedData, parentItem, parentTab) => {
    if (parentTab === 'scenes') {
      if (element._origin === 'direct-adv') {
        const newAdversaries = (parentItem.adversaries || []).map((ref, idx) => {
          if (idx !== element._originRefIndex) return ref;
          return { data: editedData, count: ref.count || 1 };
        });
        return { ...parentItem, adversaries: newAdversaries };
      }
      if (element._origin === 'direct-env') {
        const newEnvironments = (parentItem.environments || []).map((entry, idx) => {
          if (idx !== element._originRefIndex) return entry;
          return { data: editedData };
        });
        return { ...parentItem, environments: newEnvironments };
      }
    }

    return parentItem;
  };

  const handleSaveElement = async (element, editedData, mode) => {
    if (mode === 'original') {
      await saveItem(element._collection, editedData);
    } else {
      const updatedParent = applyEditedCopyToParent(element, editedData, modalState?.item, activeTab);
      await saveItem(activeTab, updatedParent);
      // Refresh modal item with updated parent.
      setModalState(prev => prev ? { ...prev, item: updatedParent } : null);
    }
  };

  // Instant client-side name filter before the debounced API search fires.
  const filteredItems = isPaginatedTab
    ? items.filter(item => !search.filters.search || item.name?.toLowerCase().includes(search.filters.search.toLowerCase()))
    : items;

  // Infinite scroll refs
  const scrollContainerRef = useRef(null);
  const sentinelRef = useRef(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollContainerRef.current;
    if (!sentinel || !container || !search.hasMore || search.isLoadingMore) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) search.loadMore(); },
      { root: container, rootMargin: '200px' }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [search.hasMore, search.isLoadingMore, search.loadMore]);

  const showingCount = search.items.length + search.trimmedCount;

  // Resolve modal item: for own items use the latest from items list so edits are fresh.
  const resolvedModalItem = modalState && !modalState.isNew
    ? (items.find(i => i.id === modalState.item?.id) || modalState.item)
    : modalState?.item;

  const modalItemIsOwn = resolvedModalItem && isOwnItem(resolvedModalItem);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar Tabs */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-4 font-semibold text-slate-300 uppercase tracking-wider text-xs">Database</div>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => navigate(`/library/${tab.id}`)}
            className={`flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${
              activeTab === tab.id ? 'bg-slate-800 text-red-400 border-r-2 border-red-500' : 'text-slate-400 hover:bg-slate-800/50'
            }`}
          >
            <tab.Icon size={18} /> {tab.label}
          </button>
        ))}
      </div>

      {showRolzImport && (
        <RolzImportModal
          onClose={() => setShowRolzImport(false)}
          saveItem={saveItem}
          data={data}
          onImportSuccess={(collection, id) => {
            setShowRolzImport(false);
            search.refresh();
          }}
        />
      )}

      {/* Item Detail / Edit Modal */}
      {modalState && resolvedModalItem !== undefined && (
        <ItemDetailModal
          item={resolvedModalItem}
          collection={activeTab}
          data={data}
          editable={modalState.isNew || modalItemIsOwn}
          enriching={!!modalState.enriching}
          onSave={handleSave}
          onSaveElement={activeTab === 'scenes' && modalItemIsOwn ? handleSaveElement : null}
          onDelete={modalItemIsOwn ? () => handleDelete(activeTab, resolvedModalItem?.id) : null}
          onClone={!modalItemIsOwn ? () => handleClone(resolvedModalItem) : null}
          onRetryParse={resolvedModalItem?._source === 'reddit' ? () => handleParseReddit(resolvedModalItem) : null}
          onForceLlmParse={resolvedModalItem?._parseMethod === 'partial' ? () => handleParseReddit(resolvedModalItem, { forceLlm: true }) : null}
          isAdmin={isAdmin}
          onBlockReddit={resolvedModalItem?._source === 'reddit' && isAdmin ? handleBlockReddit : null}
          onClose={closeModal}
        />
      )}

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">

        {/* Sticky header */}
        <div className="shrink-0 px-6 pt-6 pb-3 border-b border-slate-800/50 bg-slate-950">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
            <h2 className="text-2xl font-bold text-white capitalize">{activeTab}</h2>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setShowRolzImport(true)}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 px-3 py-1.5 rounded transition-colors border border-slate-700 hover:border-amber-700"
              >
                Import Rolz Markdown
              </button>
              <button
                onClick={openNew}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-medium ml-2"
              >
                <Plus size={16} /> New {SINGULAR_NAMES[activeTab]}
              </button>
            </div>
          </div>

          {/* Filter bar — only for adversaries / environments */}
          {isPaginatedTab && (
            <>
              <CollectionFilters
                collection={activeTab}
                filters={search.filters}
                onFilterChange={search.setFilter}
                variant="bar"
              />
              <div className="text-xs text-slate-500 -mt-3">
                {search.loading && !search.isLoadingMore
                  ? <span className="animate-pulse">Loading {activeTab}…</span>
                  : search.totalCount > 0
                    ? `Showing ${showingCount.toLocaleString()} of ${search.totalCount.toLocaleString()}`
                    : null
                }
              </div>
            </>
          )}
        </div>

        {/* Scrollable grid */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex flex-wrap gap-2">
            {filteredItems.map(item => (
              <ItemCard
                key={`${item._source || 'own'}-${item.id}`}
                item={item}
                tab={activeTab}
                data={data}
                onView={(item) => openModal(item)}
                onEdit={isOwnItem(item) ? (item) => openModal(item) : null}
                onDelete={isOwnItem(item) ? handleDelete : null}
                onClone={() => handleClone(item)}
                onAddToTable={addToTable}
              />
            ))}
            {filteredItems.length === 0 && (
              <div className="col-span-full text-center p-8 text-slate-500 border border-dashed border-slate-800 rounded-lg w-full">
                {search.loading && !search.isLoadingMore
                  ? <span className="animate-pulse">Loading {activeTab}…</span>
                  : items.length === 0
                    ? `No ${activeTab} found. Click "New" to create one.`
                    : 'No items match the selected filters.'
                }
              </div>
            )}
          </div>

          {search.isLoadingMore && (
            <div className="text-center text-slate-500 text-sm py-4 animate-pulse">
              Loading more of the {search.totalCount.toLocaleString()} entries…
            </div>
          )}
          {!search.hasMore && !search.loading && search.totalCount > 0 && (
            <div className="text-center text-slate-500 text-sm py-4">
              Loaded last of {search.totalCount.toLocaleString()} entries
            </div>
          )}
          {search.hasMore && !search.isLoadingMore && (
            <div style={{ height: 400 }} />
          )}
          <div ref={sentinelRef} className="h-1" />
        </div>
      </div>
    </div>
  );
}
