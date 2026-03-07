import { useState, useEffect, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ShieldAlert, Map, Play, BookOpen, Plus } from 'lucide-react';
import { ItemCard } from './ItemCard.jsx';
import { ImageImportModal } from './modals/ImageImportModal.jsx';
import { ItemDetailModal } from './modals/ItemDetailModal.jsx';
import { CollectionFilters } from './CollectionFilters.jsx';
import { useCollectionSearch } from '../lib/useCollectionSearch.js';
import { isOwnItem, needsHodEnrich } from '../lib/constants.js';
import { enrichItems, enrichSingleItem } from '../lib/api.js';

const CARD_WIDTH = 360;
const CARD_HEIGHT = 176;
const GAP = 8;
const COLUMN_WIDTH = CARD_WIDTH + GAP;
const ROW_HEIGHT = CARD_HEIGHT + GAP;
const PAGE_SIZE = 30;
const LOAD_DEBOUNCE_MS = 180;

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

export function LibraryView({ data, saveItem, saveImage, deleteItem, cloneItem, addToTable, route, navigate, onItemsChange, onMergeAdversary, isAdmin, partySize = 1, partyTier = 1, ensureScenesLoaded, ensureAdventuresLoaded }) {
  const [showImageImport, setShowImageImport] = useState(false);
  const [modalState, setModalState] = useState(null);
  const [nonPaginatedLoading, setNonPaginatedLoading] = useState(false);

  const activeTab = route.tab || 'adversaries';
  const isPaginatedTab = SRD_FILTER_TABS.has(activeTab);

  // Load scenes/adventures on demand when user navigates to those tabs.
  useEffect(() => {
    if (activeTab === 'scenes' && ensureScenesLoaded) {
      if ((data.scenes || []).length > 0) {
        setNonPaginatedLoading(false);
        return;
      }
      setNonPaginatedLoading(true);
      ensureScenesLoaded().finally(() => setNonPaginatedLoading(false));
    } else if (activeTab === 'adventures' && ensureAdventuresLoaded) {
      if ((data.adventures || []).length > 0) {
        setNonPaginatedLoading(false);
        return;
      }
      setNonPaginatedLoading(true);
      ensureAdventuresLoaded().finally(() => setNonPaginatedLoading(false));
    } else {
      setNonPaginatedLoading(false);
    }
  }, [activeTab, ensureScenesLoaded, ensureAdventuresLoaded, data.scenes?.length, data.adventures?.length]);

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
      // Keep URL as /library/:tab/new so the close effect doesn't fire (it closes when itemId becomes null)
      return;
    }

    // Wait for items to load before resolving the deep link.
    const found = items.find(i => i.id === itemId);
    if (!found && isPaginatedTab && search.loading) return; // still loading
    if (!found && !isPaginatedTab && (items.length === 0 || nonPaginatedLoading)) return; // not ready yet

    deepLinkProcessedRef.current = true;
    if (found) {
      setModalState({ item: found, isNew: false });
      // Keep URL as /library/:tab/:id for back/forward/link/reload
    } else if (modalState?.item?.id === itemId) {
      // Item not in items list (e.g. slot evicted, or click before items synced) but we have it from openModal — keep modal
    } else {
      // Item not found (e.g. deleted) — clear URL to avoid stuck state
      navigate(`/library/${activeTab}`, { replace: true });
    }
  }, [itemId, items, isPaginatedTab, search.loading, nonPaginatedLoading, activeTab, navigate, action, modalState]);

  // Reset deep-link flag when tab or route changes.
  useEffect(() => {
    deepLinkProcessedRef.current = false;
  }, [activeTab, itemId]);

  // Close modal when URL no longer has itemId (e.g. user pressed back).
  useEffect(() => {
    if (!itemId && modalState) {
      setModalState(null);
    }
  }, [itemId, modalState]);

  const openModal = async (item) => {
    navigate(`/library/${activeTab}/${item.id || 'new'}`);
    if (needsHodEnrich(item)) {
      setModalState({ item, isNew: false, enriching: true });
      const enriched = await enrichSingleItem(activeTab, item);
      search.patchItems({ [enriched.id]: enriched });
      setModalState({ item: enriched, isNew: false, enriching: false });
    } else {
      setModalState({ item, isNew: !item.id });
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
    if (formData.id && saveImage && (formData.imageUrl != null || formData._additionalImages != null)) {
      await saveImage(activeTab, formData.id, formData.imageUrl ?? '', { _additionalImages: formData._additionalImages });
    }
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
      const parentItem = modalState?.item;
      const parentId = parentItem?.id;

      if (parentId && saveImage && (element._origin === 'direct-adv' || element._origin === 'direct-env')) {
        const idx = element._originRefIndex;
        const path = element._origin === 'direct-adv' ? `adversaries.${idx}.data` : `environments.${idx}.data`;
        const hasBase64 = (url) => typeof url === 'string' && url.startsWith('data:');
        if (hasBase64(editedData.imageUrl) || (Array.isArray(editedData._additionalImages) && editedData._additionalImages.some(hasBase64))) {
          await saveImage(activeTab, parentId, editedData.imageUrl, { _additionalImages: editedData._additionalImages, path });
        }
      }

      const updatedParent = applyEditedCopyToParent(element, editedData, parentItem, activeTab);
      await saveItem(activeTab, updatedParent);
      setModalState(prev => prev ? { ...prev, item: updatedParent } : null);
    }
  };

  // Instant client-side name filter before the debounced API search fires.
  const filteredItems = isPaginatedTab
    ? items.filter(item => !search.filters.search || item.name?.toLowerCase().includes(search.filters.search.toLowerCase()))
    : items;


  // Resolve modal item: for own items use the latest from items list so edits are fresh.
  const resolvedModalItem = modalState && !modalState.isNew
    ? (items.find(i => i.id === modalState.item?.id) || modalState.item)
    : modalState?.item;

  const modalItemIsOwn = resolvedModalItem && isOwnItem(resolvedModalItem);

  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  const [columnCount, setColumnCount] = useState(1);

  const handleScroll = useCallback((e) => {
    const el = e.target;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom && search.hasMore && !search.loading && !search.isLoadingMore) {
      search.loadMore();
    }
  }, [search]);

  // IntersectionObserver: load more when bottom sentinel is visible (works even when content doesn't overflow)
  useEffect(() => {
    if (!isPaginatedTab || !search.hasMore || search.loading || search.isLoadingMore) return;
    const sentinel = sentinelRef.current;
    const scrollEl = scrollRef.current;
    if (!sentinel || !scrollEl) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && search.hasMore && !search.loading && !search.isLoadingMore) {
          search.loadMore();
        }
      },
      { root: scrollEl, rootMargin: '200px', threshold: 0 }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [isPaginatedTab, search.hasMore, search.loading, search.isLoadingMore, search.loadMore]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth - 48;
      const cols = Math.max(1, Math.floor(w / COLUMN_WIDTH));
      setColumnCount(cols);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isPaginatedTab, search.totalCount, search.loading]);

  const totalCount = search.totalCount ?? 0;
  const gridItems = isPaginatedTab ? filteredItems : filteredItems;
  const rowCount = columnCount > 0 ? Math.ceil(gridItems.length / columnCount) : 0;

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 2,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const showingRangeText = isPaginatedTab && search.totalCount > 0
    ? `Showing ${gridItems.length.toLocaleString()} of ${search.totalCount.toLocaleString()}`
    : null;

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

      {showImageImport && (
        <ImageImportModal
          onClose={() => setShowImageImport(false)}
          saveItem={saveItem}
          data={data}
          onImportSuccess={(collection, id) => {
            setShowImageImport(false);
            search.refresh();
            navigate(`/library/${collection}/${id}`);
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
          saveImage={saveImage}
          onDelete={modalItemIsOwn ? () => handleDelete(activeTab, resolvedModalItem?.id) : null}
          onClone={() => handleClone(resolvedModalItem)}
          onAddToTable={() => addToTable(resolvedModalItem, activeTab)}
          onEdit={modalItemIsOwn ? () => {} : null}
          isAdmin={isAdmin}
          onClose={closeModal}
          partySize={partySize}
          partyTier={partyTier}
          onMergeAdversary={onMergeAdversary}
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
                onClick={() => setShowImageImport(true)}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 px-3 py-1.5 rounded transition-colors border border-slate-700 hover:border-amber-700"
              >
                Import
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
                showSort
              />
              <div className="text-xs text-slate-500 -mt-3">
                {search.loading && !search.isLoadingMore
                  ? <span className="animate-pulse">Loading {activeTab}…</span>
                  : showingRangeText
                }
              </div>
            </>
          )}
        </div>

        {/* Scrollable content: virtualized grid for adversaries/environments, flex-wrap for scenes/adventures */}
        <div className="flex-1 min-h-0 overflow-hidden px-6 py-4 flex flex-col">
          {isPaginatedTab && gridItems.length > 0 ? (
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto" onScroll={handleScroll}>
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualItems.map(virtualRow => (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="flex gap-2"
                  >
                    {Array.from({ length: columnCount }, (_, columnIndex) => {
                      const idx = virtualRow.index * columnCount + columnIndex;
                      if (idx >= gridItems.length) return null;
                      const item = gridItems[idx];
                      return (
                        <ItemCard
                          key={`${item._source || 'own'}-${item.id}`}
                          item={item}
                          tab={activeTab}
                          data={data}
                          onView={(i) => openModal(i)}
                          onEdit={isOwnItem(item) ? (i) => openModal(i) : null}
                          onDelete={isOwnItem(item) ? handleDelete : null}
                          onClone={() => handleClone(item)}
                          onAddToTable={addToTable}
                          partySize={partySize}
                          partyTier={partyTier}
                          showSourceBadge={isPaginatedTab}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              {search.hasMore && (
                <div ref={sentinelRef} style={{ height: 1, minHeight: 1 }} aria-hidden="true" />
              )}
            </div>
          ) : isPaginatedTab && search.totalCount === 0 && !search.loading ? (
            <div className="text-center p-8 text-slate-500 border border-dashed border-slate-800 rounded-lg">
              No items match the selected filters.
            </div>
          ) : isPaginatedTab && search.loading ? (
            <div className="text-center p-8 text-slate-500 border border-dashed border-slate-800 rounded-lg animate-pulse">
              Loading {activeTab}…
            </div>
          ) : !isPaginatedTab && nonPaginatedLoading ? (
            <div className="text-center p-8 text-slate-500 border border-dashed border-slate-800 rounded-lg animate-pulse">
              Loading {activeTab}…
            </div>
          ) : !isPaginatedTab ? (
            <div className="flex flex-wrap gap-2 overflow-y-auto">
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
                  partySize={partySize}
                  partyTier={partyTier}
                  showSourceBadge={isPaginatedTab}
                />
              ))}
              {filteredItems.length === 0 && (
                <div className="w-full text-center p-8 text-slate-500 border border-dashed border-slate-800 rounded-lg">
                  {items.length === 0 ? `No ${activeTab} found. Click "New" to create one.` : 'No items match the selected filters.'}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
