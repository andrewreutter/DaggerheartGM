import { Fragment, useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ShieldAlert,
  Map as MapIcon,
  MapPinned,
  Play,
  BookOpen,
  Plus,
  ChevronDown,
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
  LayoutGrid,
  Puzzle,
  Bot,
  ScrollText,
} from 'lucide-react';
import { ItemCard } from './ItemCard.jsx';
import { LibraryAssistantPanel } from './LibraryAssistantPanel.jsx';
import { ItemDetailModal } from './modals/ItemDetailModal.jsx';
import { CollectionFilters, LibrarySearchIncludeStrip } from './CollectionFilters.jsx';
import { LibraryAllFilters } from './LibraryAllFilters.jsx';
import { DaggerstackImport } from './DaggerstackImport.jsx';
import { useCollectionSearch } from '../lib/useCollectionSearch.js';
import { buildLibraryAllApiOpts } from '../lib/library-all-api-params.js';
import { useLibraryAllSearch } from '../lib/useLibraryAllSearch.js';
import { useCharacterSrdData } from '../lib/useCharacterSrdData.js';
import { isOwnItem } from '../lib/constants.js';
import { canEditLibraryCatalogItem } from '../lib/library-catalog-edit.js';
import { loadLibraryAllCounts, conceptAiEnabled } from '../lib/api.js';
import { useAiUiPreference } from '../lib/ai-ui-preference-context.jsx';
import { shouldShowConceptAiUi } from '../lib/ai-ui-visibility.js';
import { generateId } from '../lib/helpers.js';
import { DEFAULT_LIBRARY_TAB } from '../lib/router.js';
import { buildLibraryBrowsePath, buildLibraryModalPath } from '../lib/library-modal-path.js';
import { resolveLibraryItemDeepLink } from '../lib/library-item-deep-link.js';
import { useUnifiedImport } from '../lib/unified-import-context.jsx';
import {
  SRD_UNIFIED_COLLECTIONS,
  LIBRARY_NON_CLONEABLE_COLLECTIONS,
  LIBRARY_USER_EDITABLE_COLLECTIONS,
  LIBRARY_FILTERS_PERSIST_KEY,
  LIBRARY_SEARCH_GLOBAL_KEY,
  LIBRARY_INCLUDES_GLOBAL_KEY,
  getLibraryFilterConfig,
} from '../lib/library-filter-config.js';
import { LIBRARY_SHARED_FILTERS_KEY, loadAllFiltersFromShared } from '../lib/library-shared-filters.js';
import {
  computeLibrarySnapWidths,
  snapLibraryCardWidth,
  librarySnapIndexForWidth,
  libraryColumnCountForWidth,
  scrollContentWidthPx,
  libraryWidthSliderIndexFromSnapIndex,
  librarySnapIndexFromWidthSliderIndex,
} from '../lib/library-card-snap.js';
import {
  getActiveLibraryFilterChipSpecs,
  applyLibraryFilterChipClear,
  getActiveLibraryAllFilterChipSpecs,
  applyLibraryAllFilterChipClear,
} from '../lib/library-active-filter-chips.js';
import {
  DEFAULT_LIBRARY_CARD_WIDTH as DEFAULT_CARD_WIDTH,
  DEFAULT_LIBRARY_CARD_HEIGHT as DEFAULT_CARD_HEIGHT,
  MIN_LIBRARY_CARD_WIDTH as MIN_CARD_WIDTH,
  MIN_LIBRARY_CARD_HEIGHT as MIN_CARD_HEIGHT,
  getDimensionsForTab,
  writeStoredLibraryCardDimensions,
} from '../lib/library-card-dimensions.js';

/** Fallback max card height (px) until the library scroll viewport is measured. */
const LIBRARY_CARD_HEIGHT_SLIDER_FALLBACK_MAX = 480;

const GAP = 8;
const PAGE_SIZE = 30;
const LOAD_DEBOUNCE_MS = 180;

const SINGULAR_NAMES = {
  adversaries: 'Adversary',
  environments: 'Environment',
  maps: 'Map',
  scenes: 'Scene',
  adventures: 'Adventure',
  characters: 'Character',
  abilities: 'Ability',
  ancestries: 'Ancestry',
  armor: 'Armor',
  beastforms: 'Beastform',
  campaign_frames: 'Campaign Frame',
  classes: 'Class',
  communities: 'Community',
  consumables: 'Consumable',
  domains: 'Domain',
  items: 'Item',
  rules: 'Rule',
  subclasses: 'Subclass',
  weapons: 'Weapon',
  features: 'Feature',
};

/** Full tab list (sidebar order; hidden ids omitted from `LIBRARY_NAV_TABS`). */
const TABS = [
  { id: 'scenes', label: 'Scenes', Icon: Play },
  { id: 'maps', label: 'Maps', Icon: MapPinned },
  { id: 'environments', label: 'Environments', Icon: MapIcon },
  { id: 'adversaries', label: 'Adversaries', Icon: ShieldAlert },
  { id: 'campaign_frames', label: 'Campaign Frames', Icon: BookOpen },
  { id: 'classes', label: 'Classes', Icon: GraduationCap },
  { id: 'subclasses', label: 'Subclasses', Icon: Layers },
  { id: 'ancestries', label: 'Ancestries', Icon: Dna },
  { id: 'communities', label: 'Communities', Icon: Users },
  { id: 'weapons', label: 'Weapons', Icon: Sword },
  { id: 'armor', label: 'Armor', Icon: Shield },
  { id: 'items', label: 'Items', Icon: Package },
  { id: 'consumables', label: 'Consumables', Icon: FlaskConical },
  { id: 'abilities', label: 'Abilities', Icon: Sparkles },
  { id: 'beastforms', label: 'Beastforms', Icon: PawPrint },
  { id: 'domains', label: 'Domains', Icon: Library },
  { id: 'rules', label: 'Rules', Icon: ScrollText },
  { id: 'features', label: 'Features', Icon: Puzzle },
  { id: 'characters', label: 'Characters', Icon: User },
  { id: 'adventures', label: 'Adventures', Icon: BookOpen },
];

const LIBRARY_NAV_HIDDEN_IDS = new Set(['characters', 'adventures']);
const LIBRARY_NAV_TABS = TABS.filter(t => !LIBRARY_NAV_HIDDEN_IDS.has(t.id));
const LIBRARY_NAV_SIDEBAR = [
  { id: 'assistant', label: 'Assistant', Icon: Bot },
  { id: 'all', label: 'All', Icon: LayoutGrid },
  ...LIBRARY_NAV_TABS,
];
/** Hairline after these sidebar ids (All + last item of each group). */
const LIBRARY_NAV_DIVIDER_AFTER = new Set([
  'all',
  'campaign_frames',
  'communities',
  'consumables',
  'beastforms',
]);

/** Sidebar order — every id is in `LIBRARY_USER_EDITABLE_COLLECTIONS`. */
const NEW_ITEM_COLLECTION_ORDER = TABS.map(t => t.id).filter(id => LIBRARY_USER_EDITABLE_COLLECTIONS.has(id));
const TAB_LABEL_BY_ID = Object.fromEntries(TABS.map(t => [t.id, t.label]));

/** Portaled “New” type menu — must be excluded from outside-dismiss (menu is not under `newItemMenuWrapRef`). */
const NEW_ITEM_MENU_SELECTOR = '[data-library-new-item-menu]';

/** Paginated library tabs: SRD unified collections plus scenes (official DT catalog + Mine/Public). */
const PAGINATED_LIBRARY_TABS = new Set([...SRD_UNIFIED_COLLECTIONS, 'maps', 'scenes']);

/** Game Table can only add these library types */
const TABLE_ADDABLE_COLLECTIONS = new Set(['adversaries', 'environments', 'maps', 'scenes', 'adventures', 'characters']);
const DEFAULT_ASSISTANT_SCOPE = {
  collection: 'all',
  includeMine: true,
  includePublic: true,
  includeSrd: true,
};

const noopRequireAuth = () => {};

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
  ensureAdventuresLoaded,
  ensureCharactersLoaded,
  userUid,
  /** Owned game tables for "Add to Game Table" picker */
  myTables = [],
  /** Signed-in vs anonymous. Falsy/omitted → not authenticated. */
  isAuthenticated = false,
  /** Navigate to sign-in (with return-to). No-op if omitted. */
  onRequireAuth = noopRequireAuth,
  /** Home-page embed: All tab only, no sidebar, Mine-only ephemeral search. */
  embedded = false,
  /** DB-backed map of tab → { width, height } (signed-in). Null/omit → localStorage only. */
  libraryCardDimensions = null,
  /** Called when the user changes card size for a tab (not on restore). */
  onLibraryCardDimensionsChange,
}) {
  const { srdData: libraryCharacterSrdData } = useCharacterSrdData();
  const { hideAiUi } = useAiUiPreference();
  const assistantAvailable = shouldShowConceptAiUi(conceptAiEnabled, hideAiUi);
  const activeTab = embedded ? 'all' : (route.tab || DEFAULT_LIBRARY_TAB);
  const isAssistantTab = activeTab === 'assistant';

  const guardedAddToTable = useCallback((...args) => {
    if (!isAuthenticated) { onRequireAuth?.(); return; }
    return addToTable?.(...args);
  }, [isAuthenticated, onRequireAuth, addToTable]);

  // Redirect stale deep-links to /library/assistant when AI is disabled.
  useEffect(() => {
    if (isAssistantTab && !assistantAvailable) {
      navigate('/library/all');
    }
  }, [isAssistantTab, assistantAvailable, navigate]);

  const ownedTablesForPicker = useMemo(() => {
    if (myTables.length > 0) return myTables;
    if (userUid) return [{ id: userUid, name: 'Game Table' }];
    return [];
  }, [myTables, userUid]);
  const [libraryCardWidth, setLibraryCardWidth] = useState(() =>
    getDimensionsForTab(libraryCardDimensions, activeTab, userUid).width
  );
  const [libraryCardHeight, setLibraryCardHeight] = useState(() =>
    getDimensionsForTab(libraryCardDimensions, activeTab, userUid).height
  );
  /** Skip notifying parent after programmatic restore from map/localStorage. */
  const skipCardDimPersistRef = useRef(true);
  /** Viewport width of the library card area; slider max = one full-width card per row. */
  const [libraryGridInnerWidth, setLibraryGridInnerWidth] = useState(null);
  const { openImport, enabled: unifiedImportEnabled } = useUnifiedImport();
  const [showDaggerstackImport, setShowDaggerstackImport] = useState(false);
  const [modalState, setModalState] = useState(null);
  const [nonPaginatedLoading, setNonPaginatedLoading] = useState(false);

  const lastPaginatedTabRef = useRef('abilities');
  useEffect(() => {
    if (activeTab !== 'all' && PAGINATED_LIBRARY_TABS.has(activeTab)) {
      lastPaginatedTabRef.current = activeTab;
    }
  }, [activeTab]);

  const isPaginatedTab = !isAssistantTab && (PAGINATED_LIBRARY_TABS.has(activeTab) || activeTab === 'all');
  const collectionSearchCollection = activeTab === 'all' ? lastPaginatedTabRef.current : activeTab;

  // Restore card dimensions for this user + library collection (tab) before paint.
  useLayoutEffect(() => {
    const { width, height } = getDimensionsForTab(libraryCardDimensions, activeTab, userUid);
    skipCardDimPersistRef.current = true;
    setLibraryCardWidth(width);
    setLibraryCardHeight(height);
  }, [userUid, activeTab, libraryCardDimensions]);

  const showLibraryNewControls = activeTab === 'all' || LIBRARY_USER_EDITABLE_COLLECTIONS.has(activeTab);
  const [newItemMenuOpen, setNewItemMenuOpen] = useState(false);
  const [newItemMenuPos, setNewItemMenuPos] = useState(null);
  const newItemMenuWrapRef = useRef(null);
  const filterDefaults = useMemo(() => {
    const c = getLibraryFilterConfig(activeTab === 'all' ? 'abilities' : activeTab);
    return { sort: c.defaultSort || 'popularity' };
  }, [activeTab]);

  // Load adventures/characters on demand when user navigates to those tabs.
  useEffect(() => {
    if (activeTab === 'adventures' && ensureAdventuresLoaded) {
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
  }, [activeTab, ensureAdventuresLoaded, ensureCharactersLoaded, data.adventures?.length, data.characters?.length]);

  useEffect(() => {
    writeStoredLibraryCardDimensions(userUid, activeTab, {
      width: libraryCardWidth,
      height: libraryCardHeight,
    });
    if (skipCardDimPersistRef.current) {
      skipCardDimPersistRef.current = false;
      return;
    }
    onLibraryCardDimensionsChange?.(activeTab, {
      width: libraryCardWidth,
      height: libraryCardHeight,
    });
  }, [libraryCardWidth, libraryCardHeight, userUid, activeTab, onLibraryCardDimensionsChange]);

  // If React bails out of setState after a restore (same values), the persist effect may not run —
  // still clear the skip flag so the next user edit is saved. Must run *after* the persist effect.
  useEffect(() => {
    if (!skipCardDimPersistRef.current) return;
    skipCardDimPersistRef.current = false;
  }, [userUid, activeTab, libraryCardDimensions]);

  const collectionSearch = useCollectionSearch(collectionSearchCollection, {
    limit: PAGE_SIZE,
    debounceMs: LOAD_DEBOUNCE_MS,
    persistKey: isPaginatedTab && activeTab !== 'all' ? LIBRARY_FILTERS_PERSIST_KEY : null,
    sharedSearchKey: LIBRARY_SEARCH_GLOBAL_KEY,
    sharedIncludesKey: LIBRARY_INCLUDES_GLOBAL_KEY,
    sharedLibraryFiltersKey: isPaginatedTab && activeTab !== 'all' ? LIBRARY_SHARED_FILTERS_KEY : null,
    defaultFilters: filterDefaults,
    enabled: isPaginatedTab && activeTab !== 'all',
    infinite: true,
    maxItems: 500,
  });

  // Embedded must pass `null` (not omit/`undefined`) — this hook's defaults are the
  // real localStorage keys, so undefined would still persist to the standalone Library.
  const allLibrarySearch = useLibraryAllSearch({
    limit: PAGE_SIZE,
    debounceMs: LOAD_DEBOUNCE_MS,
    persistKey: embedded ? null : LIBRARY_FILTERS_PERSIST_KEY,
    sharedSearchKey: embedded ? null : LIBRARY_SEARCH_GLOBAL_KEY,
    sharedIncludesKey: embedded ? null : LIBRARY_INCLUDES_GLOBAL_KEY,
    defaultFilters: embedded ? { includes: ['own'] } : undefined,
    enabled: activeTab === 'all',
    infinite: true,
    maxItems: 500,
  });

  // useLibraryAllSearch does not currently honor `defaultFilters`; seed Mine-only once.
  const embeddedIncludesSeededRef = useRef(false);
  useEffect(() => {
    if (!embedded || embeddedIncludesSeededRef.current) return;
    embeddedIncludesSeededRef.current = true;
    const inc = allLibrarySearch.filters.includes;
    if (Array.isArray(inc) && inc.length === 1 && inc[0] === 'own') return;
    allLibrarySearch.setFilter('includes', ['own']);
    // Seed once on embed mount; setFilter is recreated each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded]);

  const search = activeTab === 'all' ? allLibrarySearch : collectionSearch;
  const semanticFilterActive = isPaginatedTab && assistantAvailable && !!String(search.filters.semantic || '').trim();

  // Clear any stale persisted semantic filter when AI is disabled so the
  // "AI-filtered top matches" label can't show from old localStorage state.
  useEffect(() => {
    if (!assistantAvailable && search.filters.semantic) {
      search.setFilter('semantic', '');
    }
  }, [assistantAvailable, search.filters.semantic, search.setFilter]);

  const filterSig = useMemo(
    () => JSON.stringify(loadAllFiltersFromShared(LIBRARY_FILTERS_PERSIST_KEY, LIBRARY_SEARCH_GLOBAL_KEY, LIBRARY_INCLUDES_GLOBAL_KEY)),
    [search.filters, activeTab]
  );

  const navCountsCacheRef = useRef(new Map());
  const [navCounts, setNavCounts] = useState(null);
  const [navCountsLoading, setNavCountsLoading] = useState(false);

  /** Library “All” tab: counts piggyback on list response; cache + fallback when counts not yet loaded. */
  useEffect(() => {
    if (embedded) return;
    if (semanticFilterActive) {
      setNavCounts(null);
      return;
    }
    if (activeTab !== 'all') return;
    if (allLibrarySearch.countsByCollection) {
      const entry = {
        countsByCollection: allLibrarySearch.countsByCollection,
        totalCount: allLibrarySearch.totalCount,
      };
      navCountsCacheRef.current.set(filterSig, entry);
      setNavCounts(entry);
      return;
    }
    const cached = navCountsCacheRef.current.get(filterSig);
    if (cached) {
      setNavCounts(cached);
    } else {
      setNavCounts(null);
    }
  }, [embedded, activeTab, filterSig, allLibrarySearch.countsByCollection, allLibrarySearch.totalCount, semanticFilterActive]);

  /** Other SRD tabs: one debounced `library-all-counts` request per filter change (not per nav item). */
  useEffect(() => {
    if (embedded) return;
    if (semanticFilterActive) {
      setNavCounts(null);
      setNavCountsLoading(false);
      return;
    }
    if (activeTab === 'all') return;

    const merged = loadAllFiltersFromShared(LIBRARY_FILTERS_PERSIST_KEY, LIBRARY_SEARCH_GLOBAL_KEY, LIBRARY_INCLUDES_GLOBAL_KEY);
    const debounceMs = merged.search ? 400 : LOAD_DEBOUNCE_MS;
    const cached = navCountsCacheRef.current.get(filterSig);
    if (cached) {
      setNavCounts(cached);
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setNavCountsLoading(true);
      try {
        const apiOpts = buildLibraryAllApiOpts(merged);
        const r = await loadLibraryAllCounts(apiOpts);
        if (cancelled) return;
        const entry = {
          countsByCollection: r.countsByCollection || {},
          totalCount: r.totalCount ?? 0,
        };
        navCountsCacheRef.current.set(filterSig, entry);
        setNavCounts(entry);
      } catch (err) {
        if (!cancelled) console.error('Library nav counts:', err);
      } finally {
        if (!cancelled) setNavCountsLoading(false);
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [embedded, filterSig, activeTab, semanticFilterActive]);

  const navCountForTab = useCallback(
    (tabId) => {
      if (tabId === 'assistant') return null;
      if (!navCounts) return null;
      if (tabId === 'all') return navCounts.totalCount ?? 0;
      const n = navCounts.countsByCollection[tabId];
      return n == null ? 0 : n;
    },
    [navCounts]
  );

  const navCountLoading = semanticFilterActive
    ? false
    : activeTab === 'all'
      ? allLibrarySearch.loading && !allLibrarySearch.countsByCollection
      : navCountsLoading;

  useEffect(() => {
    if (activeTab === 'all') setNavCountsLoading(false);
  }, [activeTab]);

  // Sync paginated items to app-level data.
  useEffect(() => {
    if (isPaginatedTab && activeTab !== 'all' && onItemsChange) {
      onItemsChange(activeTab, search.items);
    }
  }, [search.items, activeTab, isPaginatedTab, onItemsChange]);

  // For paginated tabs, items come from the hook; for non-paginated, from app data.
  const items = isPaginatedTab ? search.items : (data[activeTab] || []);

  const filteredItems = items;

  const resolvedModalItem = modalState && !modalState.isNew
    ? (items.find(i =>
        i.id === modalState.item?.id &&
        (!modalState.item?._collection || i._collection === modalState.item._collection)
      ) || modalState.item)
    : modalState?.item;

  const modalCollection = (resolvedModalItem && resolvedModalItem._collection) ? resolvedModalItem._collection : activeTab;
  const canEditInModal = LIBRARY_USER_EDITABLE_COLLECTIONS.has(modalCollection);

  const modalItemIsOwn = resolvedModalItem && isOwnItem(resolvedModalItem);
  const modalItemCanEditCatalog = canEditLibraryCatalogItem(resolvedModalItem, {
    isAdmin,
    collection: modalCollection,
  });
  const modalItemCanEdit = (modalState?.isNew || modalItemIsOwn || modalItemCanEditCatalog) && canEditInModal;

  // Handle deep-link routes: /library/:tab/:id opens the modal.
  const { itemId, action, libraryNewCollection } = route;
  const deepLinkProcessedRef = useRef(false);
  const deepLinkRefreshAttemptedRef = useRef(false);
  const searchRefreshRef = useRef(search.refresh);
  searchRefreshRef.current = search.refresh;
  const appliedRouteQuerySigRef = useRef('');

  useEffect(() => {
    if (!isPaginatedTab) return;
    if (route.librarySemantic == null && route.librarySearchQuery == null) return;
    const sig = JSON.stringify({
      tab: activeTab,
      search: route.librarySearchQuery ?? null,
      semantic: route.librarySemantic ?? null,
    });
    if (appliedRouteQuerySigRef.current === sig) return;
    appliedRouteQuerySigRef.current = sig;
    if (route.librarySearchQuery != null && route.librarySearchQuery !== search.filters.search) {
      search.setFilter('search', route.librarySearchQuery);
    }
    if (route.librarySemantic != null && route.librarySemantic !== search.filters.semantic) {
      search.setFilter('semantic', route.librarySemantic);
    }
  }, [
    isPaginatedTab,
    route.librarySemantic,
    route.librarySearchQuery,
    activeTab,
    search,
  ]);

  const deepLinkKeyRef = useRef('');
  useEffect(() => {
    const key = `${activeTab}:${itemId || ''}`;
    if (deepLinkKeyRef.current !== key) {
      deepLinkKeyRef.current = key;
      deepLinkProcessedRef.current = false;
      deepLinkRefreshAttemptedRef.current = false;
    }

    if (deepLinkProcessedRef.current) return;
    if (!itemId) return;

    if (itemId === 'new') {
      deepLinkProcessedRef.current = true;
      if (activeTab === 'all') {
        if (libraryNewCollection && LIBRARY_USER_EDITABLE_COLLECTIONS.has(libraryNewCollection)) {
          setModalState({ item: { _collection: libraryNewCollection }, isNew: true });
          return;
        }
        navigate('/library/all', { replace: true });
        return;
      }
      setModalState({ item: {}, isNew: true });
      // Keep URL as /library/:tab/new so the close effect doesn't fire (it closes when itemId becomes null)
      return;
    }

    const { action: deepLinkAction, item: found } = resolveLibraryItemDeepLink({
      itemId,
      items,
      fallbackItems: data?.[activeTab] || [],
      loading: isPaginatedTab && search.loading,
      isPaginated: isPaginatedTab,
      refreshAttempted: deepLinkRefreshAttemptedRef.current,
      modalItemId: modalState?.item?.id ?? null,
      nonPaginatedReady: items.length > 0 && !nonPaginatedLoading,
    });

    if (deepLinkAction === 'wait' || deepLinkAction === 'ignore') return;
    if (deepLinkAction === 'refresh') {
      deepLinkRefreshAttemptedRef.current = true;
      searchRefreshRef.current?.();
      return;
    }
    if (deepLinkAction === 'open-and-refresh') {
      deepLinkRefreshAttemptedRef.current = true;
      searchRefreshRef.current?.();
    }

    deepLinkProcessedRef.current = true;
    if (deepLinkAction === 'open' || deepLinkAction === 'open-and-refresh') {
      setModalState({ item: found, isNew: false });
      // Keep URL as /library/:tab/:id for back/forward/link/reload
    } else if (deepLinkAction === 'keep-modal') {
      // Item not in items list (e.g. slot evicted, or click before items synced) but we have it from openModal — keep modal
    } else {
      // Item not found (e.g. deleted) — clear URL to avoid stuck state
      navigate(`/library/${activeTab}`, { replace: true });
    }
  }, [itemId, items, isPaginatedTab, search.loading, nonPaginatedLoading, activeTab, navigate, action, modalState, libraryNewCollection, data]);

  // Close modal when URL no longer has itemId (e.g. user pressed back).
  useEffect(() => {
    if (!itemId && modalState) {
      setModalState(null);
    }
  }, [itemId, modalState]);

  const currentLibraryRouteOpts = useMemo(
    () => ({
      search: search.filters.search || '',
      semantic: search.filters.semantic || '',
    }),
    [search.filters.search, search.filters.semantic]
  );

  const openModal = async (item) => {
    const col = item._collection || activeTab;
    navigate(buildLibraryModalPath(activeTab, col, item.id || 'new', currentLibraryRouteOpts));
    setModalState({ item, isNew: !item.id });
  };

  const openNew = useCallback(() => {
    if (!isAuthenticated) { onRequireAuth?.(); return; }
    setNewItemMenuOpen(false);
    setNewItemMenuPos(null);
    navigate(`/library/${activeTab}/new`);
  }, [isAuthenticated, onRequireAuth, activeTab, navigate]);

  const openNewForCollection = useCallback(
    (col) => {
      if (!isAuthenticated) { onRequireAuth?.(); return; }
      setNewItemMenuOpen(false);
      setNewItemMenuPos(null);
      if (activeTab === 'all') {
        navigate(`/library/all/new?c=${encodeURIComponent(col)}`);
        return;
      }
      if (col === activeTab) {
        navigate(`/library/${activeTab}/new`);
        return;
      }
      navigate(`/library/${col}/new`);
    },
    [isAuthenticated, onRequireAuth, activeTab, navigate]
  );

  const toggleNewItemMenu = useCallback(() => {
    setNewItemMenuOpen((o) => {
      if (o) {
        setNewItemMenuPos(null);
        return false;
      }
      setNewItemMenuPos(newItemMenuWrapRef.current?.getBoundingClientRect() ?? null);
      return true;
    });
  }, []);

  useEffect(() => {
    if (!newItemMenuOpen) return;
    const onDoc = (e) => {
      if (newItemMenuWrapRef.current?.contains(e.target)) return;
      if (typeof e.target?.closest === 'function' && e.target.closest(NEW_ITEM_MENU_SELECTOR)) return;
      setNewItemMenuOpen(false);
      setNewItemMenuPos(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setNewItemMenuOpen(false);
        setNewItemMenuPos(null);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [newItemMenuOpen]);

  const closeModal = () => {
    navigate(buildLibraryBrowsePath(activeTab, currentLibraryRouteOpts), { replace: true });
    setModalState(null);
  };

  const handleSave = async (formData) => {
    const itemToSave = { ...formData };
    await saveItem(modalCollection, itemToSave);
    if (formData.id && saveImage && (formData.imageUrl != null || formData._additionalImages != null)) {
      await saveImage(modalCollection, formData.id, formData.imageUrl ?? '', { _additionalImages: formData._additionalImages });
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
    if (!isAuthenticated) { onRequireAuth?.(); return; }
    const cloned = await cloneItem(modalCollection, item);
    if (isPaginatedTab) search.refresh();
    closeModal();
    // Open the clone immediately.
    setModalState({ item: cloned, isNew: false });
    navigate(buildLibraryModalPath(activeTab, modalCollection, cloned.id, currentLibraryRouteOpts));
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
  const paginatedCellCount = gridItems.length;
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
  const showingRangeText = isPaginatedTab
    ? semanticFilterActive
      ? `AI-filtered top ${gridItems.length.toLocaleString()} match${gridItems.length === 1 ? '' : 'es'}`
      : search.totalCount > 0
        ? `Showing ${gridItems.length.toLocaleString()} of ${search.totalCount.toLocaleString()}`
        : null
    : null;

  const activeFilterEmptyChips = useMemo(
    () => {
      if (!isPaginatedTab) return [];
      if (activeTab === 'all') return getActiveLibraryAllFilterChipSpecs(search.filters);
      return getActiveLibraryFilterChipSpecs(search.filters, activeTab);
    },
    [isPaginatedTab, search.filters, activeTab]
  );

  const libraryCardResize = useMemo(
    () =>
      isPaginatedTab
        ? {
            widthMin: librarySliderMin,
            widthMax: librarySliderMax,
            snapWidths: librarySnapWidths,
            heightMin: MIN_CARD_HEIGHT,
            heightMax: libraryCardHeightMax,
            onWidthChange: setLibraryCardWidth,
            onHeightChange: setLibraryCardHeight,
          }
        : null,
    [
      isPaginatedTab,
      librarySliderMin,
      librarySliderMax,
      librarySnapWidths,
      libraryCardHeightMax,
    ]
  );

  const libraryTitle = activeTab === 'all'
    ? 'All'
    : activeTab === 'assistant'
      ? 'Assistant'
      : (TAB_LABEL_BY_ID[activeTab] || activeTab);

  const getAssistantContext = useCallback(
    () => ({
      scope: DEFAULT_ASSISTANT_SCOPE,
      browseState: {
        activeTab,
        includes: search.filters.includes || [],
        search: search.filters.search || '',
        semantic: search.filters.semantic || '',
      },
    }),
    [activeTab, search.filters.includes, search.filters.search, search.filters.semantic]
  );

  return (
    <div className="flex-1 flex min-h-0 flex-col overflow-hidden">
      {isPaginatedTab && !embedded && (
        <div className="shrink-0 border-b border-dh-border/50 bg-dh-canvas pl-4 pr-9 py-3">
          <LibrarySearchIncludeStrip
            filters={search.filters}
            onFilterChange={search.setFilter}
            collection={activeTab === 'all' ? 'library' : activeTab}
            showSemantic={assistantAvailable}
          />
        </div>
      )}

      {showDaggerstackImport && (
        <div className="fixed inset-0 z-[53] flex items-center justify-center bg-black/70">
          <div className="bg-dh-surface border border-dh-strong rounded-xl shadow-2xl w-full max-w-md mx-4 p-5 relative">
            <button
              type="button"
              tabIndex={0}
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
          collection={modalCollection}
          data={data}
          editable={modalItemCanEdit}
          onSave={handleSave}
          onSaveElement={activeTab === 'scenes' && modalItemCanEdit ? handleSaveElement : null}
          saveImage={saveImage}
          onDelete={modalItemIsOwn ? () => handleDelete(modalCollection, resolvedModalItem?.id) : null}
          onClone={LIBRARY_NON_CLONEABLE_COLLECTIONS.has(modalCollection) ? undefined : () => handleClone(resolvedModalItem)}
          onAddToTable={TABLE_ADDABLE_COLLECTIONS.has(modalCollection) && !ownedTablesForPicker.length ? () => guardedAddToTable(resolvedModalItem, modalCollection) : undefined}
          addToTableMenu={TABLE_ADDABLE_COLLECTIONS.has(modalCollection) && ownedTablesForPicker.length ? {
            tables: ownedTablesForPicker,
            onPick: (tableId) => guardedAddToTable(resolvedModalItem, modalCollection, tableId),
          } : undefined}
          onEdit={modalItemCanEdit ? () => {} : null}
          isAdmin={isAdmin}
          onClose={closeModal}
          partySize={partySize}
          partyTier={partyTier}
          characters={characters}
          onMergeAdversary={onMergeAdversary}
          libraryCardDimensions={libraryCardDimensions}
          userUid={userUid}
        />
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar tabs */}
        {!embedded && (
        <div className="w-64 bg-dh-surface border-r border-dh-border flex flex-col min-h-0 h-full">
          <div className="flex-1 min-h-0 overflow-y-auto">
            {(assistantAvailable ? LIBRARY_NAV_SIDEBAR : LIBRARY_NAV_SIDEBAR.filter(t => t.id !== 'assistant')).map(tab => (
              <Fragment key={tab.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/library/${tab.id}`)}
                  className={`flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors w-full ${
                    activeTab === tab.id ? 'bg-dh-raised text-red-400 border-r-2 border-red-500' : 'text-dh-muted hover:bg-dh-raised/50'
                  }`}
                >
                  <tab.Icon size={18} className="shrink-0" />
                  <span className="min-w-0 flex-1">{tab.label}</span>
                  {tab.id !== 'assistant' && !semanticFilterActive && (
                    <span className="ml-auto shrink-0 text-xs tabular-nums text-dh-muted">
                      {navCounts == null && navCountLoading ? '—' : (navCountForTab(tab.id) ?? '—')}
                    </span>
                  )}
                </button>
                {LIBRARY_NAV_DIVIDER_AFTER.has(tab.id) && (
                  <div className="border-t border-dh-border mx-3 my-1" aria-hidden />
                )}
              </Fragment>
            ))}
          </div>
        </div>
        )}

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-dh-canvas">

        {/* Sticky header */}
        <div className="shrink-0 pl-6 pr-9 pt-3 pb-3 border-b border-dh-border/50 bg-dh-canvas">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
            <div>
              <h2 className="text-2xl font-bold text-white">{libraryTitle}</h2>
              {semanticFilterActive && (
                <p className="mt-1 text-xs uppercase tracking-wide text-sky-300">AI-filtered top matches</p>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {unifiedImportEnabled && (
                <button
                  type="button"
                  onClick={() => openImport()}
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
              {showLibraryNewControls && (
                <>
                  <div className="relative ml-2 flex items-stretch" ref={newItemMenuWrapRef}>
                    {activeTab === 'all' ? (
                      <button
                        type="button"
                        onClick={toggleNewItemMenu}
                        aria-haspopup="menu"
                        aria-expanded={newItemMenuOpen}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-medium"
                      >
                        <Plus size={16} aria-hidden /> New <ChevronDown size={16} className="opacity-90 shrink-0" aria-hidden />
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={openNew}
                          className="bg-red-600 hover:bg-red-700 text-white pl-4 pr-3 py-2 rounded-l flex items-center gap-2 text-sm font-medium border border-red-700 border-r-red-800/80"
                        >
                          <Plus size={16} aria-hidden /> New {SINGULAR_NAMES[activeTab]}
                        </button>
                        <button
                          type="button"
                          onClick={toggleNewItemMenu}
                          aria-label="Create other item types"
                          aria-haspopup="menu"
                          aria-expanded={newItemMenuOpen}
                          className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-2 rounded-r flex items-center justify-center border border-l-0 border-red-700"
                        >
                          <ChevronDown size={16} className="shrink-0 opacity-90" aria-hidden />
                        </button>
                      </>
                    )}
                  </div>
                  {newItemMenuOpen && newItemMenuPos &&
                    createPortal(
                      <>
                        <div
                          className="fixed inset-0 z-[60]"
                          aria-hidden
                          onClick={() => {
                            setNewItemMenuOpen(false);
                            setNewItemMenuPos(null);
                          }}
                        />
                        <div
                          role="menu"
                          data-library-new-item-menu=""
                          className="fixed z-[61] bg-dh-surface border border-dh-border rounded-lg shadow-xl py-1 max-h-[min(70vh,420px)] overflow-y-auto min-w-[220px]"
                          style={{
                            top: newItemMenuPos.bottom + 4,
                            left: Math.max(8, Math.min(newItemMenuPos.left, window.innerWidth - 232)),
                          }}
                        >
                          {NEW_ITEM_COLLECTION_ORDER.map((col) => (
                            <button
                              key={col}
                              type="button"
                              tabIndex={0}
                              role="menuitem"
                              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                col === activeTab && activeTab !== 'all'
                                  ? 'bg-dh-raised/80 text-red-300'
                                  : 'text-dh hover:bg-dh-hover'
                              }`}
                              onClick={() => openNewForCollection(col)}
                            >
                              {TAB_LABEL_BY_ID[col] ?? col}
                            </button>
                          ))}
                        </div>
                      </>,
                      document.body
                    )}
                </>
              )}
            </div>
          </div>

          {/* Filter bar — unified collections; “All” uses combined filters */}
          {isPaginatedTab && (
            <>
              {activeTab === 'all' ? (
                <LibraryAllFilters
                  filters={search.filters}
                  onFilterChange={search.setFilter}
                  suppressSearchInclude
                  showSemantic={assistantAvailable}
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
              ) : (
                <CollectionFilters
                  collection={activeTab}
                  filters={search.filters}
                  onFilterChange={search.setFilter}
                  variant="bar"
                  suppressSearchInclude
                  showSemantic={assistantAvailable}
                  suppressCompetingStructuralAllHighlight
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
              )}
              <div className="text-xs text-dh-muted -mt-3">
                {search.loading && !search.isLoadingMore
                  ? <span className="animate-pulse">Loading {activeTab === 'all' ? 'library' : activeTab}…</span>
                  : showingRangeText
                }
              </div>
            </>
          )}
        </div>

        {/* Scrollable content: virtualized grid for paginated tabs (SRD + scenes); flex-wrap for adventures/characters */}
        <div className="flex-1 min-h-0 overflow-hidden px-6 py-4 flex flex-col">
          {isAssistantTab ? (
            <LibraryAssistantPanel
              data={data}
              navigate={navigate}
              onOpenItem={openModal}
              onCloneItem={cloneItem ? handleClone : null}
              onAddToTableItem={guardedAddToTable}
              ownedTables={ownedTablesForPicker}
              partySize={partySize}
              partyTier={partyTier}
              characters={characters}
              getAssistantContext={getAssistantContext}
            />
          ) : isPaginatedTab ? (
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
                          const item = gridItems[idx];
                          const cardCol = activeTab === 'all' ? item._collection : activeTab;
                          return (
                            <ItemCard
                              key={`${item._collection || activeTab}-${item._source || 'own'}-${item.id}`}
                              item={item}
                              tab={cardCol}
                              data={data}
                              onView={(i) => openModal(i)}
                              onEdit={
                                isOwnItem(item) || canEditLibraryCatalogItem(item, { isAdmin, collection: cardCol })
                                  ? (i) => openModal(i)
                                  : null
                              }
                              onDelete={isOwnItem(item) ? handleDelete : null}
                              onClone={LIBRARY_NON_CLONEABLE_COLLECTIONS.has(cardCol) ? undefined : () => handleClone(item)}
                              onAddToTable={TABLE_ADDABLE_COLLECTIONS.has(activeTab === 'all' ? item._collection : activeTab) ? guardedAddToTable : undefined}
                              ownedTables={ownedTablesForPicker}
                              partySize={partySize}
                              partyTier={partyTier}
                              showSourceBadge={isPaginatedTab}
                              srdData={libraryCharacterSrdData}
                              characters={characters}
                              cardWidth={libraryCardWidth}
                              cardHeight={libraryCardHeight}
                              libraryResize={libraryCardResize}
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
                            onClick={() => (activeTab === 'all' ? applyLibraryAllFilterChipClear(spec, search.setFilter) : applyLibraryFilterChipClear(spec, search.setFilter))}
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
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="text-center p-8 text-dh-muted border border-dashed border-dh-border rounded-lg animate-pulse">
                    Loading {activeTab}…
                  </div>
                </div>
              )}
            </div>
          ) : !isPaginatedTab && nonPaginatedLoading ? (
            <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
              <div className="text-center p-8 text-dh-muted border border-dashed border-dh-border rounded-lg animate-pulse">
                Loading {activeTab}…
              </div>
            </div>
          ) : !isPaginatedTab ? (
            <div className="flex flex-wrap gap-2 overflow-y-auto content-start">
              {filteredItems.map(item => {
                const cardCol = activeTab === 'all' ? item._collection : activeTab;
                return (
                <ItemCard
                  key={`${item._collection || activeTab}-${item._source || 'own'}-${item.id}`}
                  item={item}
                  tab={cardCol}
                  data={data}
                  onView={(item) => openModal(item)}
                  onEdit={
                    isOwnItem(item) || canEditLibraryCatalogItem(item, { isAdmin, collection: cardCol })
                      ? (item) => openModal(item)
                      : null
                  }
                  onDelete={isOwnItem(item) ? handleDelete : null}
                  onClone={LIBRARY_NON_CLONEABLE_COLLECTIONS.has(cardCol) ? undefined : () => handleClone(item)}
                  onAddToTable={TABLE_ADDABLE_COLLECTIONS.has(activeTab === 'all' ? item._collection : activeTab) ? guardedAddToTable : undefined}
                  ownedTables={ownedTablesForPicker}
                  partySize={partySize}
                  partyTier={partyTier}
                  showSourceBadge={isPaginatedTab}
                  srdData={libraryCharacterSrdData}
                  characters={characters}
                />
              );
              })}
              {filteredItems.length === 0 && (
                <div className="w-full text-center p-8 text-dh-muted border border-dashed border-dh-border rounded-lg">
                  {items.length === 0 ? `No ${activeTab} found. Click "New" to create one.` : 'No items match the selected filters.'}
                </div>
              )}
            </div>
          ) : null}
        </div>
        </div>
      </div>
    </div>
  );
}
