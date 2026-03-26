import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ShieldAlert,
  Map,
  Play,
  BookOpen,
  Plus,
  User,
  X,
  Sparkles,
  Dna,
  Shield,
  PawPrint,
  GraduationCap,
  Users,
  FlaskConical,
  Library,
  Package,
  Layers,
  Sword,
} from 'lucide-react';
import { ItemCard } from './ItemCard.jsx';
import { ImageImportModal } from './modals/ImageImportModal.jsx';
import { ItemDetailModal } from './modals/ItemDetailModal.jsx';
import { CollectionFilters } from './CollectionFilters.jsx';
import { DaggerstackImport } from './DaggerstackImport.jsx';
import { useCollectionSearch } from '../lib/useCollectionSearch.js';
import { useCharacterSrdData } from '../lib/useCharacterSrdData.js';
import { isOwnItem, needsHodEnrich } from '../lib/constants.js';
import { enrichItems, enrichSingleItem } from '../lib/api.js';
import { generateId } from '../lib/helpers.js';
import { DEFAULT_LIBRARY_TAB } from '../lib/router.js';
import {
  SRD_UNIFIED_COLLECTIONS,
  LIBRARY_USER_EDITABLE_COLLECTIONS,
  LIBRARY_FILTERS_PERSIST_KEY,
  LIBRARY_SEARCH_GLOBAL_KEY,
  LIBRARY_INCLUDES_GLOBAL_KEY,
  getLibraryFilterConfig,
} from '../lib/library-filter-config.js';
import {
  computeLibrarySnapWidths,
  snapLibraryCardWidth,
  librarySnapIndexForWidth,
  libraryColumnCountForWidth,
  scrollContentWidthPx,
  libraryWidthSliderIndexFromSnapIndex,
  librarySnapIndexFromWidthSliderIndex,
} from '../lib/library-card-snap.js';
import { getActiveLibraryFilterChipSpecs, applyLibraryFilterChipClear } from '../lib/library-active-filter-chips.js';
import {
  DEFAULT_LIBRARY_CARD_WIDTH as DEFAULT_CARD_WIDTH,
  DEFAULT_LIBRARY_CARD_HEIGHT as DEFAULT_CARD_HEIGHT,
  MIN_LIBRARY_CARD_WIDTH as MIN_CARD_WIDTH,
  MIN_LIBRARY_CARD_HEIGHT as MIN_CARD_HEIGHT,
  readStoredLibraryCardWidth,
  readStoredLibraryCardHeight,
  libraryCardDimensionStorageKey,
} from '../lib/library-card-dimensions.js';

/** Fallback max card height (px) until the library scroll viewport is measured. */
const LIBRARY_CARD_HEIGHT_SLIDER_FALLBACK_MAX = 480;

const GAP = 8;
const PAGE_SIZE = 30;
const LOAD_DEBOUNCE_MS = 180;

const SINGULAR_NAMES = {
  adversaries: 'Adversary',
  environments: 'Environment',
  scenes: 'Scene',
  adventures: 'Adventure',
  characters: 'Character',
  abilities: 'Ability',
  ancestries: 'Ancestry',
  armor: 'Armor',
  beastforms: 'Beastform',
  classes: 'Class',
  communities: 'Community',
  consumables: 'Consumable',
  domains: 'Domain',
  items: 'Item',
  subclasses: 'Subclass',
  weapons: 'Weapon',
};

/** Full tab list (sidebar order; hidden ids omitted from `LIBRARY_NAV_TABS`). */
const TABS = [
  { id: 'characters', label: 'Characters', Icon: User },
  { id: 'classes', label: 'Classes', Icon: GraduationCap },
  { id: 'subclasses', label: 'Subclasses', Icon: Layers },
  { id: 'ancestries', label: 'Ancestries', Icon: Dna },
  { id: 'communities', label: 'Communities', Icon: Users },
  { id: 'weapons', label: 'Weapons', Icon: Sword },
  { id: 'armor', label: 'Armor', Icon: Shield },
  { id: 'adversaries', label: 'Adversaries', Icon: ShieldAlert },
  { id: 'environments', label: 'Environments', Icon: Map },
  { id: 'abilities', label: 'Abilities', Icon: Sparkles },
  { id: 'beastforms', label: 'Beastforms', Icon: PawPrint },
  { id: 'consumables', label: 'Consumables', Icon: FlaskConical },
  { id: 'domains', label: 'Domains', Icon: Library },
  { id: 'items', label: 'Items', Icon: Package },
  { id: 'scenes', label: 'Scenes', Icon: Play },
  { id: 'adventures', label: 'Adventures', Icon: BookOpen },
];

const LIBRARY_NAV_HIDDEN_IDS = new Set(['characters', 'scenes', 'adventures']);
const LIBRARY_NAV_TABS = TABS.filter(t => !LIBRARY_NAV_HIDDEN_IDS.has(t.id));

/** Unified paginated API (Mine + SRD + …) */
const SRD_FILTER_TABS = new Set(SRD_UNIFIED_COLLECTIONS);

/** Game Table can only add these library types */
const TABLE_ADDABLE_COLLECTIONS = new Set(['adversaries', 'environments', 'scenes', 'adventures', 'characters']);

/** Same footprint as `ItemCard` — triggers the same flow as the header "New …" button. */
function LibraryNewItemCard({ singularLabel, onClick, cardWidth = DEFAULT_CARD_WIDTH, cardHeight = DEFAULT_CARD_HEIGHT }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ width: cardWidth, height: cardHeight }}
      className="bg-dh-surface/80 border-2 border-dashed border-dh-strong rounded-lg hover:border-red-500/60 hover:bg-dh-raised/50 cursor-pointer transition-colors flex flex-row max-w-full shrink-0 items-center justify-center gap-2 text-dh-muted hover:text-red-300"
    >
      <Plus size={22} className="text-red-500/90 shrink-0" />
      <span className="text-sm font-medium">New {singularLabel}</span>
    </button>
  );
}

export function LibraryView({
  data,
  saveItem,
  saveImage,
  deleteItem,
  cloneItem,
  addToTable,
  route,
  navigate,
  onItemsChange,
  onMergeAdversary,
  isAdmin,
  partySize = 1,
  partyTier = 1,
  characters = [],
  ensureScenesLoaded,
  ensureAdventuresLoaded,
  ensureCharactersLoaded,
  userUid,
  /** Owned game tables for "Add to Game Table" picker */
  myTables = [],
}) {
  const { srdData: libraryCharacterSrdData } = useCharacterSrdData();
  const activeTab = route.tab || DEFAULT_LIBRARY_TAB;

  const ownedTablesForPicker = useMemo(() => {
    if (myTables.length > 0) return myTables;
    if (userUid) return [{ id: userUid, name: 'Game Table' }];
    return [];
  }, [myTables, userUid]);
  const [libraryCardWidth, setLibraryCardWidth] = useState(() => readStoredLibraryCardWidth(userUid, activeTab));
  const [libraryCardHeight, setLibraryCardHeight] = useState(() => readStoredLibraryCardHeight(userUid, activeTab));
  /** Viewport width of the library card area; slider max = one full-width card per row. */
  const [libraryGridInnerWidth, setLibraryGridInnerWidth] = useState(null);
  const [showImageImport, setShowImageImport] = useState(false);
  const [showDaggerstackImport, setShowDaggerstackImport] = useState(false);
  const [modalState, setModalState] = useState(null);
  const [nonPaginatedLoading, setNonPaginatedLoading] = useState(false);

  const isPaginatedTab = SRD_FILTER_TABS.has(activeTab);

  // Restore card dimensions for this signed-in user and library collection (tab) before paint.
  useLayoutEffect(() => {
    setLibraryCardWidth(readStoredLibraryCardWidth(userUid, activeTab));
    setLibraryCardHeight(readStoredLibraryCardHeight(userUid, activeTab));
  }, [userUid, activeTab]);

  const canCreateNew = LIBRARY_USER_EDITABLE_COLLECTIONS.has(activeTab);
  const filterDefaults = useMemo(() => {
    const c = getLibraryFilterConfig(activeTab);
    return { sort: c.defaultSort || 'popularity' };
  }, [activeTab]);

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
    } else if (activeTab === 'characters' && ensureCharactersLoaded) {
      if ((data.characters || []).length > 0) {
        setNonPaginatedLoading(false);
        return;
      }
      setNonPaginatedLoading(true);
      ensureCharactersLoaded().finally(() => setNonPaginatedLoading(false));
    } else {
      setNonPaginatedLoading(false);
    }
  }, [activeTab, ensureScenesLoaded, ensureAdventuresLoaded, ensureCharactersLoaded, data.scenes?.length, data.adventures?.length, data.characters?.length]);

  useEffect(() => {
    try {
      localStorage.setItem(libraryCardDimensionStorageKey(userUid, activeTab, 'Width'), String(libraryCardWidth));
    } catch { /* ignore */ }
  }, [libraryCardWidth, userUid, activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem(libraryCardDimensionStorageKey(userUid, activeTab, 'Height'), String(libraryCardHeight));
    } catch { /* ignore */ }
  }, [libraryCardHeight, userUid, activeTab]);

  const search = useCollectionSearch(activeTab, {
    limit: 20,
    debounceMs: 400,
    persistKey: isPaginatedTab ? LIBRARY_FILTERS_PERSIST_KEY : null,
    sharedSearchKey: LIBRARY_SEARCH_GLOBAL_KEY,
    sharedIncludesKey: LIBRARY_INCLUDES_GLOBAL_KEY,
    defaultFilters: filterDefaults,
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
  /** Scrollport height of the paginated library grid (`scrollRef`); drives max card height (one row ≈ viewport). */
  const [libraryScrollClientHeight, setLibraryScrollClientHeight] = useState(0);

  const librarySnapWidths = useMemo(
    () => computeLibrarySnapWidths(libraryGridInnerWidth, GAP, MIN_CARD_WIDTH),
    [libraryGridInnerWidth]
  );

  const librarySnapIndex = useMemo(
    () => librarySnapIndexForWidth(libraryCardWidth, librarySnapWidths),
    [libraryCardWidth, librarySnapWidths]
  );

  const libraryWidthSliderSnapIndex = useMemo(
    () => libraryWidthSliderIndexFromSnapIndex(librarySnapWidths.length, librarySnapIndex),
    [librarySnapWidths.length, librarySnapIndex]
  );

  const librarySliderMax = libraryGridInnerWidth ?? DEFAULT_CARD_WIDTH;
  const librarySliderMin = Math.min(MIN_CARD_WIDTH, librarySliderMax);

  const libraryCardHeightMax = useMemo(() => {
    if (libraryScrollClientHeight > 0) {
      return Math.max(MIN_CARD_HEIGHT, libraryScrollClientHeight - GAP);
    }
    return LIBRARY_CARD_HEIGHT_SLIDER_FALLBACK_MAX;
  }, [libraryScrollClientHeight]);

  const columnStride = libraryCardWidth + GAP;
  const rowHeight = libraryCardHeight + GAP;

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

  // Use scroll `padding-right` so the (non-absolute) virtualizer is narrower than the scrollport; rows are
  // `position:absolute` inside that virtualizer, so they respect its width. Also `scrollbar-gutter: stable`
  // reserves the vertical scrollbar track so overlay scrollbars (macOS) don’t paint on top of cards.
  useLayoutEffect(() => {
    if (!isPaginatedTab) return;
    const el = scrollRef.current;
    if (!el) return;
    const updateLayout = () => {
      const w = scrollContentWidthPx(el);
      const snaps = computeLibrarySnapWidths(w, GAP, MIN_CARD_WIDTH);
      setLibraryGridInnerWidth(w);
      setLibraryCardWidth(prev => {
        const capped = Math.min(prev, w);
        return snaps.length ? snapLibraryCardWidth(capped, snaps) : capped;
      });
    };
    updateLayout();
    const ro = new ResizeObserver(updateLayout);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isPaginatedTab, search.totalCount, search.loading]);

  useLayoutEffect(() => {
    if (!isPaginatedTab || libraryGridInnerWidth == null) return;
    const w = libraryGridInnerWidth;
    setColumnCount(libraryColumnCountForWidth(w, libraryCardWidth, GAP));
  }, [isPaginatedTab, libraryGridInnerWidth, libraryCardWidth]);

  useLayoutEffect(() => {
    setLibraryCardHeight(h => Math.min(Math.max(h, MIN_CARD_HEIGHT), libraryCardHeightMax));
  }, [libraryCardHeightMax, MIN_CARD_HEIGHT]);

  const gridItems = isPaginatedTab ? filteredItems : filteredItems;

  useLayoutEffect(() => {
    if (!isPaginatedTab) {
      setLibraryScrollClientHeight(0);
      return;
    }
    const el = scrollRef.current;
    if (!el) return;
    const sync = () => setLibraryScrollClientHeight(el.clientHeight);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isPaginatedTab, activeTab, gridItems.length, search.loading, search.totalCount]);
  const paginatedCellCount = gridItems.length > 0 ? gridItems.length + (canCreateNew ? 1 : 0) : 0;
  const rowCount = columnCount > 0 && paginatedCellCount > 0 ? Math.ceil(paginatedCellCount / columnCount) : 0;

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 2,
  });

  // Virtualizer memo deps omit estimateSize; when row height changes, clear cached sizes so
  // translateY positions and getTotalSize() stay aligned with the cards.
  useLayoutEffect(() => {
    if (!isPaginatedTab) return;
    rowVirtualizer.measure();
  }, [isPaginatedTab, rowHeight, rowCount, columnCount, rowVirtualizer]);

  const virtualItems = rowVirtualizer.getVirtualItems();
  const showingRangeText = isPaginatedTab && search.totalCount > 0
    ? `Showing ${gridItems.length.toLocaleString()} of ${search.totalCount.toLocaleString()}`
    : null;

  const activeFilterEmptyChips = useMemo(
    () => (isPaginatedTab ? getActiveLibraryFilterChipSpecs(search.filters, activeTab) : []),
    [isPaginatedTab, search.filters, activeTab]
  );

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar Tabs */}
      <div className="w-64 bg-dh-surface border-r border-dh-border flex flex-col">
        {LIBRARY_NAV_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => navigate(`/library/${tab.id}`)}
            className={`flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${
              activeTab === tab.id ? 'bg-dh-raised text-red-400 border-r-2 border-red-500' : 'text-dh-muted hover:bg-dh-raised/50'
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

      {showDaggerstackImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-dh-surface border border-dh-strong rounded-xl shadow-2xl w-full max-w-md mx-4 p-5 relative">
            <button
              onClick={() => setShowDaggerstackImport(false)}
              className="absolute top-3 right-3 text-dh-muted hover:text-dh transition-colors"
            >
              <X size={18} />
            </button>
            <h3 className="text-base font-semibold text-white mb-4">Import Character from Daggerstack</h3>
            <DaggerstackImport
              compact
              onImported={async (character) => {
                const charToSave = { ...character, id: generateId() };
                delete charToSave.elementType;
                delete charToSave.conditions;
                delete charToSave.playerName;
                const saved = await saveItem('characters', charToSave);
                if (saved) {
                  setShowDaggerstackImport(false);
                  navigate(`/library/characters/${saved.id}`);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Item Detail / Edit Modal */}
      {modalState && resolvedModalItem !== undefined && (
        <ItemDetailModal
          item={resolvedModalItem}
          collection={activeTab}
          data={data}
          editable={(modalState.isNew || modalItemIsOwn) && canCreateNew}
          enriching={!!modalState.enriching}
          onSave={handleSave}
          onSaveElement={activeTab === 'scenes' && modalItemIsOwn ? handleSaveElement : null}
          saveImage={saveImage}
          onDelete={modalItemIsOwn ? () => handleDelete(activeTab, resolvedModalItem?.id) : null}
          onClone={() => handleClone(resolvedModalItem)}
          onAddToTable={TABLE_ADDABLE_COLLECTIONS.has(activeTab) && !ownedTablesForPicker.length ? () => addToTable(resolvedModalItem, activeTab) : undefined}
          addToTableMenu={TABLE_ADDABLE_COLLECTIONS.has(activeTab) && ownedTablesForPicker.length ? {
            tables: ownedTablesForPicker,
            onPick: (tableId) => addToTable(resolvedModalItem, activeTab, tableId),
          } : undefined}
          onEdit={modalItemIsOwn ? () => {} : null}
          isAdmin={isAdmin}
          onClose={closeModal}
          partySize={partySize}
          partyTier={partyTier}
          characters={characters}
          onMergeAdversary={onMergeAdversary}
        />
      )}

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-dh-canvas">

        {/* Sticky header */}
        <div className="shrink-0 pl-6 pr-9 pt-6 pb-3 border-b border-dh-border/50 bg-dh-canvas">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
            <h2 className="text-2xl font-bold text-white capitalize">{activeTab}</h2>

            <div className="flex items-center gap-3 flex-wrap">
              {(activeTab === 'adversaries' || activeTab === 'environments') && (
                <button
                  type="button"
                  onClick={() => setShowImageImport(true)}
                  className="text-xs bg-dh-raised hover:bg-dh-hover text-amber-400 hover:text-amber-300 px-3 py-1.5 rounded transition-colors border border-dh-strong hover:border-amber-700"
                >
                  Import
                </button>
              )}
              {activeTab === 'characters' && (
                <button
                  type="button"
                  onClick={() => setShowDaggerstackImport(true)}
                  className="text-xs bg-dh-raised hover:bg-dh-hover text-amber-400 hover:text-amber-300 px-3 py-1.5 rounded transition-colors border border-dh-strong hover:border-amber-700"
                >
                  Import from Daggerstack
                </button>
              )}
              {canCreateNew && (
                <button
                  type="button"
                  onClick={openNew}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-medium ml-2"
                >
                  <Plus size={16} /> New {SINGULAR_NAMES[activeTab]}
                </button>
              )}
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
                viewSlider={{
                  ...(librarySnapWidths.length > 0
                    ? {
                        snapValues: librarySnapWidths,
                        snapIndex: libraryWidthSliderSnapIndex,
                        onSnapChange: (idx) => {
                          const inner = librarySnapIndexFromWidthSliderIndex(librarySnapWidths.length, idx);
                          const next = librarySnapWidths[inner];
                          if (next != null) setLibraryCardWidth(next);
                        },
                      }
                    : {
                        value: Math.min(Math.max(libraryCardWidth, librarySliderMin), librarySliderMax),
                        onChange: setLibraryCardWidth,
                        min: librarySliderMin,
                        max: librarySliderMax,
                        step: 1,
                      }),
                  height: {
                    value: Math.min(Math.max(libraryCardHeight, MIN_CARD_HEIGHT), libraryCardHeightMax),
                    onChange: setLibraryCardHeight,
                    min: MIN_CARD_HEIGHT,
                    max: libraryCardHeightMax,
                    step: 1,
                  },
                }}
              />
              <div className="text-xs text-dh-muted -mt-3">
                {search.loading && !search.isLoadingMore
                  ? <span className="animate-pulse">Loading {activeTab}…</span>
                  : showingRangeText
                }
              </div>
            </>
          )}
        </div>

        {/* Scrollable content: virtualized grid for SRD unified tabs; flex-wrap for scenes/adventures */}
        <div className="flex-1 min-h-0 overflow-hidden px-6 py-4 flex flex-col">
          {isPaginatedTab ? (
            <div
              ref={scrollRef}
              className="dh-library-grid-scroll flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden pr-4"
              onScroll={handleScroll}
            >
              {gridItems.length > 0 ? (
                <>
                  <div
                    className="min-w-0 w-full"
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
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
                        className="flex min-w-0 gap-2"
                      >
                        {Array.from({ length: columnCount }, (_, columnIndex) => {
                          const idx = virtualRow.index * columnCount + columnIndex;
                          if (idx >= paginatedCellCount) return null;
                          if (canCreateNew && idx === gridItems.length) {
                            return (
                              <LibraryNewItemCard
                                key="library-new-item"
                                singularLabel={SINGULAR_NAMES[activeTab]}
                                onClick={openNew}
                                cardWidth={libraryCardWidth}
                                cardHeight={libraryCardHeight}
                              />
                            );
                          }
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
                              onAddToTable={TABLE_ADDABLE_COLLECTIONS.has(activeTab) ? addToTable : undefined}
                              ownedTables={ownedTablesForPicker}
                              partySize={partySize}
                              partyTier={partyTier}
                              showSourceBadge={isPaginatedTab}
                              srdData={libraryCharacterSrdData}
                              characters={characters}
                              cardWidth={libraryCardWidth}
                              cardHeight={libraryCardHeight}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  {search.hasMore && (
                    <div ref={sentinelRef} style={{ height: 1, minHeight: 1 }} aria-hidden="true" />
                  )}
                </>
              ) : !search.loading ? (
                <div className="flex flex-col gap-4">
                  <div className="text-center p-8 text-dh-muted border border-dashed border-dh-border rounded-lg">
                    <p className="text-base text-dh-muted">No items match the selected filters.</p>
                    {activeFilterEmptyChips.length > 0 && (
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        {activeFilterEmptyChips.map(spec => (
                          <button
                            key={spec.key}
                            type="button"
                            onClick={() => applyLibraryFilterChipClear(spec, search.setFilter)}
                            title={spec.title ? `${spec.title} — click to reset` : `Reset to default — ${spec.label}`}
                            aria-label={spec.title ? `${spec.title}: ${spec.label}` : `Reset filter to default: ${spec.label}`}
                            className="inline-flex max-w-full items-center gap-2 rounded-full border border-dh-strong bg-dh-raised/80 px-4 py-2 text-left text-base leading-snug text-dh hover:border-red-500/60 hover:bg-dh-raised hover:text-red-200 transition-colors"
                          >
                            <span className="min-w-0 break-words">{spec.label}</span>
                            <X size={18} strokeWidth={2} className="shrink-0 opacity-70" aria-hidden />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {canCreateNew && (
                    <LibraryNewItemCard
                      singularLabel={SINGULAR_NAMES[activeTab]}
                      onClick={openNew}
                      cardWidth={libraryCardWidth}
                      cardHeight={libraryCardHeight}
                    />
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="text-center p-8 text-dh-muted border border-dashed border-dh-border rounded-lg animate-pulse">
                    Loading {activeTab}…
                  </div>
                  {canCreateNew && (
                    <LibraryNewItemCard
                      singularLabel={SINGULAR_NAMES[activeTab]}
                      onClick={openNew}
                      cardWidth={libraryCardWidth}
                      cardHeight={libraryCardHeight}
                    />
                  )}
                </div>
              )}
            </div>
          ) : !isPaginatedTab && nonPaginatedLoading ? (
            <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
              <div className="text-center p-8 text-dh-muted border border-dashed border-dh-border rounded-lg animate-pulse">
                Loading {activeTab}…
              </div>
              <LibraryNewItemCard singularLabel={SINGULAR_NAMES[activeTab]} onClick={openNew} />
            </div>
          ) : !isPaginatedTab ? (
            <div className="flex flex-wrap gap-2 overflow-y-auto content-start">
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
                  onAddToTable={TABLE_ADDABLE_COLLECTIONS.has(activeTab) ? addToTable : undefined}
                  ownedTables={ownedTablesForPicker}
                  partySize={partySize}
                  partyTier={partyTier}
                  showSourceBadge={isPaginatedTab}
                  srdData={libraryCharacterSrdData}
                  characters={characters}
                />
              ))}
              {filteredItems.length === 0 && (
                <div className="w-full text-center p-8 text-dh-muted border border-dashed border-dh-border rounded-lg">
                  {items.length === 0 ? `No ${activeTab} found. Click "New" to create one.` : 'No items match the selected filters.'}
                </div>
              )}
              <LibraryNewItemCard singularLabel={SINGULAR_NAMES[activeTab]} onClick={openNew} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
