import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { createPortal } from 'react-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { BookOpen, LayoutDashboard, ChevronDown, LogOut, Upload, Download, Trash2, Circle, Plus, ScrollText, Sparkles, Bot, ShieldOff, Bug, Ellipsis } from 'lucide-react';

import { auth, getAuthToken, CLIENT_ID, loadCollection, loadTableState, resolveItems, saveItem as apiSaveItem, saveImage as apiSaveImage, deleteItem as apiDeleteItem, cloneItemToLibrary, recordPlay, fetchMe, fetchMyRooms, fetchMyTables, fetchPublicTables, createTable, postCharacterUpdate, postAddCharacter, postTableOp, postLifeSupportSelect, postRestMoveSelect, normalizeRoll, conceptAiEnabled, imageGenEnabled, fetchTableBillingStatus, postMapImageFile, postMapImageFileForTable, postMapImageObject, postGenerateInviteLink, postRevokeInviteLink, postJoinInviteToken, postLeaveTable, putUserPreferences } from './lib/api.js';
import { dataUrlToFile, loadImageNaturalSizeFromUrl } from './lib/map-image-data-url.js';
import { AiUiPreferenceProvider, useAiUiPreference } from './lib/ai-ui-preference-context.jsx';
import { shouldShowConceptAiUi } from './lib/ai-ui-visibility.js';
import {
  isLibraryCardDimensionsEmpty,
  mergeLibraryCardDimensions,
  normalizeLibraryCardDimensions,
  readAllStoredLibraryCardDimensions,
  writeStoredLibraryCardDimensions,
} from './lib/library-card-dimensions.js';
import { generateId } from './lib/helpers.js';
import { regenerateSceneIdsForTablePlacement } from './lib/scene-id-remap.js';
import { computeSessionCountdownUpdatesFromRoll } from './lib/session-countdowns.js';
import { resetOnboardingState } from './lib/onboarding-storage.js';
import { isOwnItem, DEFAULT_CHARACTER_STARTING_HOPE } from './lib/constants.js';
import { shouldCloneOnAddToTable } from './lib/add-to-table-clone.js';
import { applyLibraryArtToSceneMaps, buildAddMapOpFromLibraryItem, buildEmptyLibraryMap } from './lib/map-library.js';
import { planTableMapLibraryImport } from './lib/map-library-import.js';
import { shouldOfferReplaceOrAdd, buildSceneSnapshotTableOp, sceneHasActiveBattleMods } from './lib/scene-load-dialog.js';
import { UPDATE_BASE_DATA_RUNTIME_KEYS, applyTableOp } from './lib/table-ops.js';
import { applyInventoryMove, normalizePartyLoot } from './lib/party-loot.js';
import {
  buildLibraryAdversaryElements,
  characterCountFromElements,
  applyMinionGroupReconcilePlan,
  planMinionGroupReconcile,
} from './lib/party-scaled-adversaries.js';
import { isTablePlayAllowed, isPrepModeElementUpdateBlocked } from './lib/table-session-gate.js';
import { grantSpotlightToCharacter, showChooseSpotlightBanner } from './lib/spotlight.js';
import { shouldStartGmTableRoomEffects } from './lib/gm-table-sse-ownership-gate.js';
import { shouldFetchTableState, tableAccessErrorAfterFetch } from './lib/table-state-load.js';
import { billingNavIndicatorCopy } from './lib/billing-status-copy.js';
import {
  collectNavTableEntries,
  loadTableNavAccessMap,
  persistTableNavAccess,
  pickRecentNavTables,
  shouldShowNavMoreTables,
} from './lib/nav-recent-tables.js';
import { shouldPersistMapViewToTable } from './lib/map-view-sync.js';
import { DEFAULT_LEGACY_MAP_ID, deriveMapConfigForViewId, deriveMapConfigForMapId } from './lib/map-table-state.js';
import { DEFAULT_MAP_SIZE_FT } from './lib/map-dimensions-ft.js';
import { playerCanAccessMapViewSelection } from './lib/map-view-player-sync.js';
import { reconcileElementsById } from './lib/reconcile-active-elements.js';
import { reconcileMapsById, reconcileMapViewsById, reconcileMapConfig } from './lib/reconcile-map-state.js';
import { shouldOptimisticallyPatch } from './lib/optimistic-update-fields.js';
import {
  addConditionsHistoryEntry,
  removeConditionsHistoryEntry,
} from './lib/conditions-history.js';
const NON_PAGINATED_COLLECTIONS = ['scenes', 'adventures', 'characters'];

import { useRouter, legacyGmTableToCanonical, DEFAULT_LIBRARY_TAB, shouldHandleSpaNavClick } from './lib/router.js';
import { NavBtn } from './components/NavBtn.jsx';
import { LibraryView } from './components/LibraryView.jsx';
import { LibraryAssistantModal } from './components/LibraryAssistantPanel.jsx';
import { GMTableView } from './components/GMTableView.jsx';
import { SceneAdoptDialog } from './components/SceneAdoptDialog.jsx';
import { EditChoiceDialog } from './components/modals/EditChoiceDialog.jsx';
import { FeatureAuthoringGuideModal } from './components/FeatureAuthoringGuideModal.jsx';
import { SessionBlockedBanner } from './components/SessionBlockedBanner.jsx';
import { ChooseSpotlightBanner } from './components/ChooseSpotlightBanner.jsx';
import { AppRoot } from './components/AppRoot.jsx';
import { UnifiedImportProvider, useUnifiedImport } from './lib/unified-import-context.jsx';
import { AuthLanding } from './components/AuthLanding.jsx';
import { HomeAuthenticated } from './components/HomeAuthenticated.jsx';
import { HomeFeatureShots } from './components/HomeFeatureShots.jsx';
import { AdminAiUsagePage } from './components/AdminAiUsagePage.jsx';
import { AdminBugReportsPage } from './components/AdminBugReportsPage.jsx';
import { Footer } from './components/Footer.jsx';
import { TermsPage } from './components/legal/TermsPage.jsx';
import { PrivacyPage } from './components/legal/PrivacyPage.jsx';
import { SupportPage } from './components/legal/SupportPage.jsx';
import { CookiesPage } from './components/legal/CookiesPage.jsx';
import { buildLibraryModalPath } from './lib/library-modal-path.js';

function NavImportBtn() {
  const { openImport, enabled } = useUnifiedImport();
  if (!enabled) return null;
  return (
    <NavBtn icon={<Upload size={16} />} label="Import" active={false} onClick={() => openImport()} />
  );
}

function UserMenuAiTurnOn({ onPicked }) {
  const { hideAiUi, turnOnAiUi } = useAiUiPreference();
  if (!(conceptAiEnabled || imageGenEnabled) || !hideAiUi) return null;
  return (
    <>
      <div className="border-t border-dh-strong my-1" />
      <button
        type="button"
        onClick={() => {
          onPicked();
          void turnOnAiUi().catch((e) => console.error(e));
        }}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-dh hover:bg-dh-hover hover:text-dh transition-colors"
      >
        <Bot size={15} /> Turn on AI Features
      </button>
    </>
  );
}

function NavAssistantBtn({ active, onClick }) {
  const { hideAiUi } = useAiUiPreference();
  if (!shouldShowConceptAiUi(conceptAiEnabled, hideAiUi)) return null;
  return <NavBtn icon={<Bot />} label="Assistant" active={active} onClick={onClick} />;
}

function LibraryAssistantModalGated(props) {
  const { hideAiUi } = useAiUiPreference();
  if (!shouldShowConceptAiUi(conceptAiEnabled, hideAiUi)) return null;
  return <LibraryAssistantModal {...props} />;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { route, navigate } = useRouter();

  const [data, setData] = useState({
    adversaries: [],
    environments: [],
    scenes: [],
    adventures: [],
    characters: [],
  });

  // Incremented to force LibraryView to remount (e.g. after bulk delete).
  const [libraryKey, setLibraryKey] = useState(0);
  /** Battle map viewport width/height — fed from BattleMap for unified import map camera rectangles. */
  const [battleMapViewportAspect, setBattleMapViewportAspect] = useState(16 / 9);

  const [activeElements, setActiveElements] = useState([]);
  const [playerEmails, setPlayerEmails] = useState([]); // GM's invited player emails
  const [inviteLink, setInviteLink] = useState(null);
  const [featureCountdowns, setFeatureCountdowns] = useState({});
  const [sessionCountdowns, setSessionCountdowns] = useState([]);

  // Server snapshots arrive pre-resolved (characters merged with library data), so
  // activeElements is the single source of truth for both GM and player views.
  const partySize = useMemo(() => Math.max(1, activeElements.filter(el => el.elementType === 'character').length), [activeElements]);
  const partyTier = useMemo(() => {
    const chars = activeElements.filter(el => el.elementType === 'character');
    return chars.length > 0 ? Math.max(...chars.map(c => c.tier ?? 1)) : 1;
  }, [activeElements]);
  const characters = useMemo(
    () => activeElements.filter(el => el.elementType === 'character').map(c => ({ name: c.name, tier: c.tier ?? 1 })),
    [activeElements]
  );
  const DEFAULT_BATTLE_MODS = { lessDifficult: false, slightlyMoreDangerous: false, damageBoostPlusOne: false, damageBoostD4: false, damageBoostStatic: false, moreDangerous: false };
  const [tableBattleMods, setTableBattleMods] = useState(DEFAULT_BATTLE_MODS);
  const [nextScenes, setNextScenes] = useState([]);
  const [fearCount, setFearCount] = useState(0);
  const [partyLoot, setPartyLoot] = useState(() => normalizePartyLoot(null));
  const [spotlight, setSpotlight] = useState(null);
  const [conditionsHistory, setConditionsHistory] = useState([]);
  const [tableName, setTableName] = useState('');
  const [tableGmDisplayName, setTableGmDisplayName] = useState('');
  /** Billing status for the primary/current table (used by ambient nav indicator). */
  const [primaryTableBillingStatus, setPrimaryTableBillingStatus] = useState(null);
  const DEFAULT_MAP_CONFIG = {
    mapImageUrl: null,
    mapDimension: 'width',
    mapSizeFt: DEFAULT_MAP_SIZE_FT,
    mapImageNaturalWidth: null,
    mapImageNaturalHeight: null,
    mapAiImagePrompt: null,
  };
  const [mapConfig, setMapConfig] = useState(DEFAULT_MAP_CONFIG);
  /** Parallel battle maps + shared active map id (from `table_state`; derived `mapConfig` matches active map). */
  const [maps, setMaps] = useState([]);
  const [mapReplaceChoice, setMapReplaceChoice] = useState(null);
  const [activeMapId, setActiveMapId] = useState(null);
  /** GM broadcast map framing — `table_state.gmMapView` (per-map zoom/pan normalized). */
  const [gmMapView, setGmMapView] = useState(null);
  /** Named cameras — `table_state.mapViews`; GM's selection `gmActiveViewId`. */
  const [mapViews, setMapViews] = useState([]);
  const [gmActiveViewId, setGmActiveViewId] = useState(null);
  /** Player: which broadcast/personal view row is driving the map area (localStorage per table). */
  const [playerSelectedViewId, setPlayerSelectedViewId] = useState(null);
  /** Player: map-tile free pan/zoom (not a broadcast view or personal camera). */
  const [playerFreeMapExplore, setPlayerFreeMapExplore] = useState(false);
  const [playerFreeExploreMapId, setPlayerFreeExploreMapId] = useState(null);
  /** GM-broadcast hint: incrementing seq so invited players align to the same map view (when allowed). */
  const [playerMapViewFocus, setPlayerMapViewFocus] = useState(null);
  const playerMapViewFocusSeqAppliedRef = useRef(0);
  const [lifeSupportSelections, setLifeSupportSelections] = useState({}); // { [rollDbId]: instanceId } — shared across GM/player windows
  const [restMovesSelections, setRestMovesSelections] = useState({}); // { [rollDbId]: { [instanceId]: { move1, move2, ... } } }
  /** V2 shared table bags (e.g. Bard Rally) — persisted in `table_state.featureState` */
  const [tableFeatureState, setTableFeatureState] = useState({});
  /** `table_state.top` — when absent (legacy), session is treated as active */
  const [tableTop, setTableTop] = useState(null);
  const [pendingSceneAdd, setPendingSceneAdd] = useState(null); // { scene, moreScenes?, targetTableId }
  // tableStateReady: true after we've applied table state for the current table (avoids opening name editor before load)
  const [tableStateReady, setTableStateReady] = useState(false);
  const tableStateReadyRef = useRef(false);
  const adventuresLoadedRef = useRef(false);
  const charactersLoadedRef = useRef(false);
  const adventuresLoadPromiseRef = useRef(null);
  const charactersLoadPromiseRef = useRef(null);
  const adventuresCacheRef = useRef([]);
  const charactersCacheRef = useRef([]);
  const charLoadResolversRef = useRef([]);
  // Tracks BattleMap's current viewport center in feet; updated via onViewportCenterChange.
  // Used as fallback placement position when paste/drop opens the quick-pick menu without explicit coords.
  const mapViewportCenterRef = useRef(null);

  const [isAdmin, setIsAdmin] = useState(false);
  /** After first `fetchMe` for this session — avoids redirecting admins before `/api/me` returns. */
  const [adminPrivilegesKnown, setAdminPrivilegesKnown] = useState(false);
  /** When true, hide concept-AI and image-gen AI entry points (persisted via `PUT /api/me/preferences`). */
  const [hideAiUi, setHideAiUi] = useState(false);
  /** Per-tab Library card width/height from `user_preferences` (signed-in). */
  const [libraryCardDimensions, setLibraryCardDimensions] = useState({});
  const [libraryCardDimensionsLoaded, setLibraryCardDimensionsLoaded] = useState(false);
  const libraryCardDimensionsRef = useRef(libraryCardDimensions);
  libraryCardDimensionsRef.current = libraryCardDimensions;
  const libraryCardDimensionsSaveTimerRef = useRef(null);
  const libraryCardDimensionsMigratedRef = useRef(false);
  const [myRooms, setMyRooms] = useState([]); // [{ tableId, gmUid, gmName, tableName, characterCount, characterNames }]
  const [myTables, setMyTables] = useState([]); // [{ id, name, characterCount, characterNames, previewUrl }]
  const [tableNavAccess, setTableNavAccess] = useState({});
  const [publicTables, setPublicTables] = useState([]);
  // Bumped each time the home SSE pushes a new home_public snapshot; HomeAuthenticated watches
  // this as a dep to re-run a live search when the default top-3 list updates.
  const [publicLobbyGeneration, setPublicLobbyGeneration] = useState(0);
  const [connectedPlayers, setConnectedPlayers] = useState([]); // [{ uid, name, email, photoURL }]
  const [playerNames, setPlayerNames] = useState({}); // { [email_lowercase]: displayName } — persisted in table_state
  // pendingBanners: authoritative list from the 'banners' subscription channel
  const [pendingBanners, setPendingBanners] = useState([]);
  /** Ephemeral map click pings (SSE `map_ping`); not persisted */
  const [mapPings, setMapPings] = useState([]);
  /** Ephemeral scribble segments (SSE `map_scribble`); not persisted */
  const [mapScribbles, setMapScribbles] = useState([]);
  // pendingPlayerIntent: pre-roll intent broadcast by a player before dice are rolled (GM sees this)
  const [pendingPlayerIntent, setPendingPlayerIntent] = useState(null);
  // intentDifficultyUpdate: latest `intent` SSE payload as seen by a player — used to detect when the
  // GM has finalized the difficulty for that player's own pending pre-roll banner.
  const [intentDifficultyUpdate, setIntentDifficultyUpdate] = useState(null);
  const [spotlightRequestGrant, setSpotlightRequestGrant] = useState(null);
  // Player-only: banner IDs for which a feature reroll was requested, keyed by reaction stateKey (optimistic feedback)
  const [featureRequestedBannerIdsByKey, setFeatureRequestedBannerIdsByKey] = useState(() => ({}));
  // Player-only: banner IDs for which Ranger's Focus reroll was requested
  const [rangerFocusRequestedBannerIds, setRangerFocusRequestedBannerIds] = useState(() => new Set());
  const [actionLog, setActionLog] = useState([]);
  // Track which _rollDbIds are already in the action log to avoid duplicates when
  // the pendingBanners effect races with roll-history seeding on reconnect.
  const seenLogDbIdsRef = useRef(new Set());
  /** Dedupe session countdown automation per roll id (pending banner). */
  const sessionCountdownAutomationRollsRef = useRef(new Set());
  // GM preview-as-player mode: non-null email means the GM is previewing that player's view
  const [previewAsPlayerEmail, setPreviewAsPlayerEmail] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [featureAuthoringGuideOpen, setFeatureAuthoringGuideOpen] = useState(false);
  const [libraryAssistantOpen, setLibraryAssistantOpen] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [onboardingFlash, setOnboardingFlash] = useState('');
  const [deleteTablePending, setDeleteTablePending] = useState(null); // { id, name } when confirming delete
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const userMenuRef = useRef(null);
  const myTablesFetchedRef = useRef(false);
  /** Firebase uid of the table owner; set from GET table_state (ownerUid). Undefined until first load for this tableId. */
  const [tableOwnerUid, setTableOwnerUid] = useState(undefined);
  /** Set to 'not-found' | 'private' when GET table_state fails. */
  const [tableAccessError, setTableAccessError] = useState(null);
  const [tableIsPublic, setTableIsPublic] = useState(false);
  const [audienceOnlineCount, setAudienceOnlineCount] = useState(0);
  /** Set when `/join/:token` redemption fails (invalid or revoked). */
  const [joinLinkError, setJoinLinkError] = useState(null);
  const joinRedeemedTokenRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!deleteTablePending) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') { setDeleteTablePending(null); setDeleteConfirmInput(''); }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [deleteTablePending]);

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    setIsAdmin(false);
    setMyRooms([]);
    setMyTables([]);
    setConnectedPlayers([]);
    setPendingBanners([]);
    setMapPings([]);
    tableStateReadyRef.current = false;
    adventuresLoadedRef.current = false;
    adventuresCacheRef.current = [];
  setActiveElements([]);
  try {
    await signOut(auth);
      navigate('/');
    } catch (err) {
      console.error('Sign-Out Error:', err);
    }
  };

  const handleDeleteAllData = async () => {
    setUserMenuOpen(false);
    const collections = ['adversaries', 'environments', 'scenes', 'adventures'];
    // Fetch all own items across all collections to count and delete
    const allOwn = await Promise.all(collections.map(col =>
      loadCollection(col, { limit: 10000 }).then(r => ({ col, items: r.items.filter(isOwnItem) }))
    ));
    const totalItems = allOwn.reduce((sum, { items }) => sum + items.length, 0);
    if (!window.confirm(`Delete all ${totalItems} item(s)? This cannot be undone.`)) return;
    for (const { col, items } of allOwn) {
      for (const item of items) {
        await apiDeleteItem(col, item.id);
      }
    }
    setData({ adversaries: [], environments: [], scenes: [], adventures: [] });
    adventuresLoadedRef.current = false;
    adventuresCacheRef.current = [];
    setActiveElements([]);
    tableStateReadyRef.current = false;
    apiDeleteItem('table_state', 'current').catch(() => {});
    tableStateReadyRef.current = true;
    // Force LibraryView to remount so its hook refetches (now returning empty results).
    setLibraryKey(k => k + 1);
  };

  const handleExport = async () => {
    setUserMenuOpen(false);
    const collections = ['adversaries', 'environments', 'scenes', 'adventures'];
    const allData = await Promise.all(collections.map(col =>
      loadCollection(col, { limit: 10000 }).then(r => [col, r.items.filter(isOwnItem)])
    ));
    const exportObj = Object.fromEntries(allData);
    const jsonStr = JSON.stringify(exportObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'daggerheart_db.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleEnableOnboarding = () => {
    resetOnboardingState();
    setUserMenuOpen(false);
    setOnboardingFlash('Onboarding tips enabled');
    setTimeout(() => setOnboardingFlash(''), 2500);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUserMenuOpen(false);
    setImportStatus('Importing...');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        const collections = ['adversaries', 'environments', 'scenes', 'adventures'];
        for (const colName of collections) {
          if (importedData[colName]) {
            for (const item of importedData[colName]) {
              await saveItem(colName, item);
            }
          }
        }
        setImportStatus('Done!');
        setTimeout(() => setImportStatus(''), 2000);
      } catch (err) {
        setImportStatus('Error!');
        setTimeout(() => setImportStatus(''), 2000);
      }
    };
    reader.readAsText(file);
  };

  const userRef = useRef(null);
  const routeRef = useRef(null);
  const lastLibraryPathRef = useRef(`/library/${DEFAULT_LIBRARY_TAB}`);


  // Load adventures on demand. Returns the adventures array.
  const ensureAdventuresLoaded = useCallback(async () => {
    if (adventuresLoadedRef.current) return adventuresCacheRef.current;
    if (adventuresLoadPromiseRef.current) return adventuresLoadPromiseRef.current;
    const promise = (async () => {
      try {
        const result = await loadCollection('adventures', { limit: 1000 });
        const adventures = result.items || [];
        if (!userRef.current) return [];
        setData(prev => {
          if ((prev.adventures || []).length > 0) return prev;
          return { ...prev, adventures };
        });
        adventuresLoadedRef.current = true;
        adventuresCacheRef.current = adventures;
        return adventures;
      } finally {
        adventuresLoadPromiseRef.current = null;
      }
    })();
    adventuresLoadPromiseRef.current = promise;
    return promise;
  }, []);

  // ensureCharactersLoaded does NOT fetch on its own — the uid effect is the sole owner
  // of data.characters. This avoids getAuthToken() picking up the wrong Firebase user
  // during initialization. Callers that need data immediately (ItemPickerModal, LibraryView)
  // either get the cache or wait for the uid effect to complete.
  const ensureCharactersLoaded = useCallback(async () => {
    if (charactersLoadedRef.current) return charactersCacheRef.current;
    return new Promise(resolve => {
      charLoadResolversRef.current.push(resolve);
    });
  }, []);

  const requireAuthRedirect = useCallback((mode = 'signin') => {
    const current = window.location.pathname + window.location.search;
    navigate(`/?authMode=${mode}&returnTo=${encodeURIComponent(current)}`);
  }, [navigate]);

  const handleCreateTable = useCallback(async () => {
    try {
      const { id, name } = await createTable('New Table');
      setMyTables(prev => [...prev, { id, name }]);
      navigate(`/table/${id}`);
    } catch (err) {
      console.error('Create table failed:', err);
    }
  }, [navigate]);

  useEffect(() => {
    if (!auth) { setLoading(false); return; }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      userRef.current = currentUser;
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        const params = new URLSearchParams(window.location.search);
        const returnTo = params.get('returnTo');
        if (returnTo) {
          navigate(decodeURIComponent(returnTo), { replace: true });
        } else if (window.location.pathname === '/' && window.location.search) {
          navigate('/', { replace: true });
        }
        fetchMe()
          .then(({ isAdmin: admin, preferences }) => {
            setIsAdmin(admin);
            setHideAiUi(!!preferences?.hideAiUi);
            setLibraryCardDimensions(normalizeLibraryCardDimensions(preferences?.libraryCardDimensions));
            setLibraryCardDimensionsLoaded(true);
            libraryCardDimensionsMigratedRef.current = false;
          })
          .catch(() => {})
          .finally(() => setAdminPrivilegesKnown(true));
        fetchMyRooms().then(rooms => setMyRooms(rooms)).catch(() => {});
        fetchMyTables().then(tables => {
          const list = tables || [];
          setMyTables(list);
          myTablesFetchedRef.current = true;
          // Fetch billing status for the first owned table (ambient nav indicator).
          const primaryId = list[0]?.id;
          if (primaryId) {
            fetchTableBillingStatus(primaryId).then(setPrimaryTableBillingStatus).catch(() => {});
          }
        }).catch(() => { myTablesFetchedRef.current = true; });
        fetchPublicTables().then((rows) => setPublicTables(Array.isArray(rows) ? rows : [])).catch(() => setPublicTables([]));
      } else {
        myTablesFetchedRef.current = false;
        setPublicTables([]);
        setHideAiUi(false);
        setLibraryCardDimensions({});
        setLibraryCardDimensionsLoaded(false);
        libraryCardDimensionsMigratedRef.current = false;
        if (libraryCardDimensionsSaveTimerRef.current) {
          clearTimeout(libraryCardDimensionsSaveTimerRef.current);
          libraryCardDimensionsSaveTimerRef.current = null;
        }
        setIsAdmin(false);
        setAdminPrivilegesKnown(false);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // One-shot: if DB has no card sizes yet, upload scoped localStorage values for this user.
  useEffect(() => {
    if (!user?.uid || !libraryCardDimensionsLoaded || libraryCardDimensionsMigratedRef.current) return;
    if (!isLibraryCardDimensionsEmpty(libraryCardDimensions)) {
      libraryCardDimensionsMigratedRef.current = true;
      return;
    }
    const fromLs = readAllStoredLibraryCardDimensions(user.uid);
    libraryCardDimensionsMigratedRef.current = true;
    if (isLibraryCardDimensionsEmpty(fromLs)) return;
    setLibraryCardDimensions(fromLs);
    libraryCardDimensionsRef.current = fromLs;
    putUserPreferences({ libraryCardDimensions: fromLs }).catch(() => {});
  }, [user?.uid, libraryCardDimensionsLoaded, libraryCardDimensions]);

  const scheduleLibraryCardDimensionsSave = useCallback(() => {
    if (libraryCardDimensionsSaveTimerRef.current) {
      clearTimeout(libraryCardDimensionsSaveTimerRef.current);
    }
    libraryCardDimensionsSaveTimerRef.current = setTimeout(() => {
      libraryCardDimensionsSaveTimerRef.current = null;
      const map = libraryCardDimensionsRef.current;
      putUserPreferences({ libraryCardDimensions: map }).catch(() => {});
    }, 500);
  }, []);

  const handleLibraryCardDimensionsChange = useCallback((tab, dims) => {
    if (!user?.uid || !tab || !dims) return;
    writeStoredLibraryCardDimensions(user.uid, tab, dims);
    setLibraryCardDimensions((prev) => {
      const next = mergeLibraryCardDimensions(prev, { [tab]: dims });
      libraryCardDimensionsRef.current = next;
      return next;
    });
    scheduleLibraryCardDimensionsSave();
  }, [user?.uid, scheduleLibraryCardDimensionsSave]);

  // Keep routeRef current
  useEffect(() => { routeRef.current = route; }, [route]);

  // Load characters once auth settles. Uses user.getIdToken() directly (NOT getAuthToken())
  // because during Firebase init, auth.currentUser may briefly be a different user (e.g. the
  // GM whose table this player is on). By getting the token from the React-state `user` object,
  // we guarantee the request matches the settled UID.
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    const thisUser = user;
    (async () => {
      try {
        const token = await thisUser.getIdToken();
        if (cancelled) return;
        const params = new URLSearchParams({ offset: '0', limit: '1000', sort: 'popularity' });
        const res = await fetch(`/api/data/characters?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled || !res.ok) return;
        const result = await res.json();
        const chars = result.items || [];
        setData(prev => ({ ...prev, characters: chars }));
        charactersLoadedRef.current = true;
        charactersCacheRef.current = chars;
        // Resolve any ensureCharactersLoaded callers waiting for this data.
        charLoadResolversRef.current.forEach(r => r(chars));
        charLoadResolversRef.current = [];
      } catch (err) {
        if (!cancelled) console.error('Failed to load characters:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid]);

  const isInvitedPlayerHeuristic = !!(user && route.tableId && myRooms.some(r => r.tableId === route.tableId) && !myTables.some(t => t.id === route.tableId));
  const isOwner = !!(user && (
    tableOwnerUid === user.uid
    || (tableOwnerUid === undefined && myTables.some((t) => t.id === route.tableId))
  ));
  const isInvited = !!(user && (
    isInvitedPlayerHeuristic
    || (user.email && Array.isArray(playerEmails) && playerEmails.includes(user.email))
  ));
  const isSpectator = route.view === 'table' && !!route.tableId && tableIsPublic && !isOwner && !isInvited && tableOwnerUid != null;
  const isPlayer = route.view === 'table' && !!user && !!route.tableId && !isOwner && (
    isInvited
    || (!tableIsPublic && tableOwnerUid != null && tableOwnerUid !== user.uid)
  );

  useEffect(() => {
    if (!user?.uid) {
      setTableNavAccess({});
      return;
    }
    setTableNavAccess(loadTableNavAccessMap(user.uid));
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || route.view !== 'table' || !route.tableId) return;
    setTableNavAccess(persistTableNavAccess(user.uid, route.tableId));
  }, [user?.uid, route.view, route.tableId]);

  const navTableEntries = useMemo(
    () => collectNavTableEntries(myTables, myRooms),
    [myTables, myRooms],
  );
  const navRecentTables = useMemo(
    () => pickRecentNavTables(navTableEntries, {
      accessByTableId: tableNavAccess,
      currentTableId: route.view === 'table' ? route.tableId : null,
    }),
    [navTableEntries, tableNavAccess, route.view, route.tableId],
  );
  const showNavMoreTables = shouldShowNavMoreTables(navTableEntries.length);

  useEffect(() => {
    if (myTablesFetchedRef.current && myTables.length === 0 && route.view === 'table' && user && !isPlayer && !isSpectator) {
      if (tableOwnerUid === undefined && !tableAccessError) return;
      if (tableOwnerUid && tableOwnerUid !== user.uid) return;
      navigate('/', { replace: true });
    }
  }, [myTables.length, route.view, user, isPlayer, isSpectator, tableOwnerUid, tableAccessError, navigate]);

  useEffect(() => {
    if (loading || user) return;
    if (route.view === 'adminAiUsage' || route.view === 'adminBugReports' || route.view === 'join') {
      requireAuthRedirect('signin');
    }
  }, [loading, user, route.view, requireAuthRedirect]);

  useEffect(() => {
    if (loading || user) return;
    if (route.view === 'table' && tableAccessError === 'private') {
      requireAuthRedirect('signin');
    }
  }, [loading, user, route.view, tableAccessError, requireAuthRedirect]);

  useEffect(() => {
    if (!user || route.view !== 'adminAiUsage' || !adminPrivilegesKnown) return;
    if (!isAdmin) {
      navigate(`/library/${DEFAULT_LIBRARY_TAB}`, { replace: true });
    }
  }, [user, route.view, isAdmin, adminPrivilegesKnown, navigate]);

  useEffect(() => {
    if (!user || route.view !== 'adminBugReports' || !adminPrivilegesKnown) return;
    if (!isAdmin) {
      navigate(`/library/${DEFAULT_LIBRARY_TAB}`, { replace: true });
    }
  }, [user, route.view, isAdmin, adminPrivilegesKnown, navigate]);

  useEffect(() => {
    if (route.view !== 'join' || !user || !route.token) return;
    if (joinRedeemedTokenRef.current === route.token) return;
    joinRedeemedTokenRef.current = route.token;
    setJoinLinkError(null);
    (async () => {
      try {
        const result = await postJoinInviteToken(route.token);
        fetchMyRooms().then(rooms => setMyRooms(rooms)).catch(() => {});
        navigate(`/table/${result.tableId}`, { replace: true });
      } catch (err) {
        console.error('Failed to join table:', err);
        setJoinLinkError('This invite link is invalid or has been revoked.');
      }
    })();
  }, [route.view, route.token, user, navigate]);

  // Home SSE: keep Owner / Player / Public card lists live while the homepage is open.
  // Opens only when the user is signed in and route.view === 'home'.
  useEffect(() => {
    if (!user || route.view !== 'home') return;
    let es;
    let reconnectTimer;
    const connect = async () => {
      const token = await getAuthToken();
      if (!token || !userRef.current) return;
      es = new EventSource(`/api/home/stream?token=${encodeURIComponent(token)}`);
      es.addEventListener('home_owned', (e) => {
        try {
          const tables = JSON.parse(e.data);
          if (Array.isArray(tables)) setMyTables(tables);
        } catch { /* ignore */ }
      });
      es.addEventListener('home_invited', (e) => {
        try {
          const rooms = JSON.parse(e.data);
          if (Array.isArray(rooms)) setMyRooms(rooms);
        } catch { /* ignore */ }
      });
      es.addEventListener('home_public', (e) => {
        try {
          const tables = JSON.parse(e.data);
          if (Array.isArray(tables)) {
            setPublicTables(tables);
            setPublicLobbyGeneration((g) => g + 1);
          }
        } catch { /* ignore */ }
      });
      es.onerror = () => { es.close(); reconnectTimer = setTimeout(connect, 3000); };
    };
    connect();
    return () => { es?.close(); if (reconnectTimer) clearTimeout(reconnectTimer); };
  }, [user?.uid, route.view]);

  // GM can preview the table as a specific player (non-persisted; cleared on reload)
  const isPreviewMode = !isPlayer && !isSpectator && !!previewAsPlayerEmail && route.view === 'table';
  const effectiveIsPlayer = isPlayer || isPreviewMode || isSpectator;
  // Characters are assigned by email, so use email as the player identity for both real and preview mode
  const effectivePlayerEmail = isPlayer ? user?.email : (isPreviewMode ? previewAsPlayerEmail : undefined);

  const playerViewStorageKey =
    route.view === 'table' && route.tableId && effectiveIsPlayer ? `dh_player_map_view:${route.tableId}` : null;

  const defaultPlayerViewId = useMemo(() => {
    if (!mapViews.length) return null;
    const candidates = mapViews.filter(v => {
      if (!v.broadcastToPlayers) return false;
      return maps.some(x => x.id === v.mapId);
    });
    return candidates[0]?.id ?? null;
  }, [mapViews, maps]);

  const battleMapConfig = useMemo(() => {
    if (!effectiveIsPlayer) return mapConfig;
    if (playerFreeMapExplore && playerFreeExploreMapId) {
      return deriveMapConfigForMapId({ maps, mapViews }, playerFreeExploreMapId);
    }
    const vid = playerSelectedViewId ?? defaultPlayerViewId;
    if (!vid || !mapViews.length) return mapConfig;
    return deriveMapConfigForViewId({ maps, mapViews }, vid);
  }, [
    effectiveIsPlayer,
    mapConfig,
    playerSelectedViewId,
    defaultPlayerViewId,
    maps,
    mapViews,
    playerFreeMapExplore,
    playerFreeExploreMapId,
  ]);

  useEffect(() => {
    if (!playerViewStorageKey) return;
    try {
      const raw = localStorage.getItem(playerViewStorageKey);
      if (raw) {
        const id = JSON.parse(raw);
        if (typeof id === 'string') setPlayerSelectedViewId(id);
      }
    } catch { /* ignore */ }
  }, [playerViewStorageKey]);

  useEffect(() => {
    if (!playerViewStorageKey || !playerSelectedViewId) return;
    try {
      localStorage.setItem(playerViewStorageKey, JSON.stringify(playerSelectedViewId));
    } catch { /* ignore */ }
  }, [playerViewStorageKey, playerSelectedViewId]);

  /** When no views are broadcast to players, use free map explore on a shared map (not a silent named view). */
  useEffect(() => {
    if (!effectiveIsPlayer) return;
    const hasBroadcastView = mapViews.some((v) => v.broadcastToPlayers);
    if (!hasBroadcastView) {
      if (playerSelectedViewId) setPlayerSelectedViewId(null);
      if (playerFreeMapExplore) return;
      const shared = maps.filter((m) => m.shareWithPlayers !== false);
      if (shared.length === 0) return;
      const prefer =
        activeMapId && shared.some((m) => m.id === activeMapId)
          ? activeMapId
          : shared[0].id;
      setPlayerFreeMapExplore(true);
      setPlayerFreeExploreMapId(prefer);
      return;
    }
    if (playerSelectedViewId) {
      const sel = mapViews.find((x) => x.id === playerSelectedViewId);
      if (sel && !sel.broadcastToPlayers) setPlayerSelectedViewId(null);
    }
  }, [effectiveIsPlayer, mapViews, maps, activeMapId, playerSelectedViewId, playerFreeMapExplore]);

  useEffect(() => {
    if (!effectiveIsPlayer || !mapViews.length) return;
    if (!playerSelectedViewId && defaultPlayerViewId && !playerFreeMapExplore) {
      setPlayerSelectedViewId(defaultPlayerViewId);
      return;
    }
    if (playerSelectedViewId && !mapViews.some(v => v.id === playerSelectedViewId)) {
      setPlayerSelectedViewId(defaultPlayerViewId);
    }
  }, [effectiveIsPlayer, mapViews, playerSelectedViewId, defaultPlayerViewId, playerFreeMapExplore]);

  const handlePlayerSelectMapView = useCallback((viewId) => {
    setPlayerFreeMapExplore(false);
    setPlayerFreeExploreMapId(null);
    setPlayerSelectedViewId(viewId);
  }, []);

  const handlePlayerEnterMapFreeExplore = useCallback((mapId) => {
    setPlayerFreeMapExplore(true);
    setPlayerFreeExploreMapId(mapId);
    setPlayerSelectedViewId(null);
  }, []);

  const handlePlayerExitMapFreeExplore = useCallback(() => {
    setPlayerFreeMapExplore(false);
    setPlayerFreeExploreMapId(null);
  }, []);

  useEffect(() => {
    if (!effectiveIsPlayer) return;
    const focus = playerMapViewFocus;
    if (!focus || typeof focus.seq !== 'number') return;
    if (focus.seq <= playerMapViewFocusSeqAppliedRef.current) return;
    if (!playerCanAccessMapViewSelection({ maps, mapViews }, focus)) return;
    playerMapViewFocusSeqAppliedRef.current = focus.seq;
    if (focus.viewId) {
      setPlayerFreeMapExplore(false);
      setPlayerFreeExploreMapId(null);
      setPlayerSelectedViewId(focus.viewId);
    } else if (focus.freeMapExploreMapId) {
      setPlayerFreeMapExplore(true);
      setPlayerFreeExploreMapId(focus.freeMapExploreMapId);
      setPlayerSelectedViewId(null);
    }
  }, [effectiveIsPlayer, playerMapViewFocus, maps, mapViews]);

  // Helper used by BattleMap for immediate local visual feedback (before SSE snapshot arrives).
  // In Phase 1 this is only used when DATABASE_URL is not set (no-DB dev mode).
  const updateActiveElement = useCallback((instanceId, updates) => {
    setActiveElements(prev => prev.map(el => el.instanceId === instanceId ? { ...el, ...updates } : el));
  }, []);

  const dismissMapPing = useCallback((id) => {
    setMapPings(prev => prev.filter(p => p.id !== id));
  }, []);

  const appendMapPing = useCallback((p) => {
    if (!p?.id) return;
    setMapPings(prev => (prev.some(x => x.id === p.id) ? prev : [...prev.slice(-30), p]));
  }, []);

  const appendMapScribble = useCallback((evt) => {
    if (!evt?.id) return;
    if (evt._clientId === CLIENT_ID) return;
    setMapScribbles((prev) => (prev.some((x) => x.id === evt.id) ? prev : [...prev.slice(-400), evt]));
  }, []);

  const consumeSpotlightRequestGrant = useCallback(() => setSpotlightRequestGrant(null), []);
  const handleSpotlightRequestGrantedEvent = useCallback((e) => {
    try {
      const payload = JSON.parse(e.data);
      if (!payload || typeof payload !== 'object') return;
      if (payload.instanceId) {
        setSpotlight((prev) => grantSpotlightToCharacter(prev, payload.instanceId));
      }
      setSpotlightRequestGrant(payload);
    } catch { /* ignore */ }
  }, []);

  // Canonicalize legacy /gm-table/... URLs (needs user uid for bare /gm-table and /gm-table/:collection/:id)
  useEffect(() => {
    if (!user) return;
    const pathname = window.location.pathname;
    const canon = legacyGmTableToCanonical(pathname, user.uid);
    if (canon && canon !== pathname) {
      navigate(canon, { replace: true });
    }
  }, [user?.uid, navigate, route.view, route.tableId, route.modalCollection, route.modalItemId]);

  // When tableId changes on table view, clear local state so we don't show stale data before SSE snapshot
  const prevTableIdRef = useRef(null);
  useEffect(() => {
    setTableOwnerUid(undefined);
    setTableAccessError(null);
    setTableIsPublic(false);
    setAudienceOnlineCount(0);
  }, [route.tableId]);

  useEffect(() => {
    playerMapViewFocusSeqAppliedRef.current = 0;
  }, [route.tableId]);

  useEffect(() => {
    if (route.view !== 'table' || !route.tableId) return;
    if (prevTableIdRef.current !== null && prevTableIdRef.current !== route.tableId) {
      setActiveElements([]);
      setFearCount(0);
      setPartyLoot(normalizePartyLoot(null));
      setSpotlight(null);
      setConditionsHistory([]);
      setFeatureCountdowns({});
      setSessionCountdowns([]);
      setTableBattleMods({});
      setNextScenes([]);
      setPlayerEmails([]);
      setInviteLink(null);
      setTableName('');
      setMapConfig(DEFAULT_MAP_CONFIG);
      setMaps([]);
      setActiveMapId(null);
      setGmMapView(null);
      setMapViews([]);
      setGmActiveViewId(null);
      setPlayerSelectedViewId(null);
      setPlayerFreeMapExplore(false);
      setPlayerFreeExploreMapId(null);
      setPlayerMapViewFocus(null);
      setLifeSupportSelections({});
      setRestMovesSelections({});
      setTableFeatureState({});
      setTableTop(null);
      setTableStateReady(false);
      setMapPings([]);
      setMapScribbles([]);
      setSpotlightRequestGrant(null);
    }
    prevTableIdRef.current = route.tableId;
  }, [route.view, route.tableId]);

  // Load table state when viewing a table (initial paint before SSE)
  useEffect(() => {
    if (!shouldFetchTableState({ view: route.view, tableId: route.tableId, authSettled: !loading })) return;
    let cancelled = false;
    loadTableState(route.tableId).then((items) => {
      if (cancelled) return;
      const accessErr = tableAccessErrorAfterFetch({ ok: true });
      if (accessErr !== undefined) setTableAccessError(accessErr);
      const tableState = items?.[0];
      if (!tableState) {
        setTableOwnerUid(null);
        setActiveElements([]);
        setFeatureCountdowns({});
        setSessionCountdowns([]);
        setTableBattleMods(DEFAULT_BATTLE_MODS);
        setNextScenes([]);
        setFearCount(0);
        setPartyLoot(normalizePartyLoot(null));
        setSpotlight(null);
        setConditionsHistory([]);
        setPlayerEmails([]);
        setInviteLink(null);
        setTableName('');
        setMapConfig(DEFAULT_MAP_CONFIG);
        setMaps([]);
        setActiveMapId(null);
        setGmMapView(null);
        setMapViews([]);
        setGmActiveViewId(null);
        setPlayerSelectedViewId(null);
        setPlayerMapViewFocus(null);
        setLifeSupportSelections({});
        setRestMovesSelections({});
        setTableFeatureState({});
        setTableTop(null);
        setTableStateReady(true);
        tableStateReadyRef.current = true;
        return;
      }
      setTableOwnerUid(tableState.ownerUid ?? null);
      setTableIsPublic(tableState.isPublic === true);
      if (Array.isArray(tableState.elements)) setActiveElements(tableState.elements);
      setFeatureCountdowns(tableState.featureCountdowns || {});
      setSessionCountdowns(Array.isArray(tableState.sessionCountdowns) ? tableState.sessionCountdowns : []);
      if (tableState.tableBattleMods) setTableBattleMods(tableState.tableBattleMods);
      setNextScenes(Array.isArray(tableState.nextScenes) ? tableState.nextScenes : []);
      if (tableState.fearCount != null) setFearCount(tableState.fearCount);
      setPartyLoot(normalizePartyLoot(tableState.partyLoot));
      if (tableState.spotlight) setSpotlight(tableState.spotlight);
      else setSpotlight(null);
      setConditionsHistory(Array.isArray(tableState.conditionsHistory) ? tableState.conditionsHistory : []);
      if (Array.isArray(tableState.playerEmails)) setPlayerEmails(tableState.playerEmails);
      setInviteLink(tableState.inviteLink ?? null);
      if (tableState.tableName != null) setTableName(tableState.tableName);
      if (tableState.gmDisplayName != null) setTableGmDisplayName(tableState.gmDisplayName);
      if (tableState.mapConfig && typeof tableState.mapConfig === 'object') {
        setMapConfig({ ...DEFAULT_MAP_CONFIG, ...tableState.mapConfig });
      } else {
        setMapConfig(DEFAULT_MAP_CONFIG);
      }
      if (Array.isArray(tableState.maps)) setMaps(tableState.maps);
      else setMaps([]);
      if (tableState.activeMapId != null) setActiveMapId(tableState.activeMapId);
      else setActiveMapId(null);
      if (tableState.gmMapView != null && typeof tableState.gmMapView === 'object') {
        setGmMapView(tableState.gmMapView);
      } else {
        setGmMapView(null);
      }
      if (Array.isArray(tableState.mapViews)) setMapViews(tableState.mapViews);
      else setMapViews([]);
      if (tableState.gmActiveViewId != null) setGmActiveViewId(tableState.gmActiveViewId);
      else setGmActiveViewId(null);
      if (tableState.playerMapViewFocus != null && typeof tableState.playerMapViewFocus === 'object') {
        setPlayerMapViewFocus(tableState.playerMapViewFocus);
      } else {
        setPlayerMapViewFocus(null);
      }
      if (tableState.lifeSupportSelections != null) setLifeSupportSelections(tableState.lifeSupportSelections);
      if (tableState.restMovesSelections != null) setRestMovesSelections(tableState.restMovesSelections);
      if (tableState.featureState != null && typeof tableState.featureState === 'object') {
        setTableFeatureState(tableState.featureState);
      } else {
        setTableFeatureState({});
      }
      if (tableState.top != null && typeof tableState.top === 'object') {
        setTableTop(tableState.top);
      } else {
        setTableTop(null);
      }
      setTableStateReady(true);
      tableStateReadyRef.current = true;
      const isOwner = tableState.ownerUid && userRef.current?.uid === tableState.ownerUid;
      if (isOwner && Array.isArray(tableState.maps) && tableState.maps.some((m) => m && !m.libraryMapId)) {
        void (async () => {
          try {
            const { items } = await loadCollection('maps', { includeMine: true, includeSrd: false, includePublic: false, limit: 100, sort: 'name' });
            const byUrl = new Map();
            for (const it of items || []) {
              const u = it.mapImageUrl || it.imageUrl;
              if (u && !byUrl.has(u)) byUrl.set(u, it);
            }
            const plan = planTableMapLibraryImport(tableState.maps, {
              existingLibraryByUrl: byUrl,
              mapViews: tableState.mapViews,
              elements: tableState.elements,
            });
            for (const row of plan.create) {
              await apiSaveItem('maps', row);
            }
            if (plan.link.length) {
              await postTableOp({ op: 'link-maps-library', links: plan.link }, route.tableId);
            }
          } catch (backfillErr) {
            console.warn('Map library backfill failed', backfillErr);
          }
        })();
      }
    }).catch(err => {
      if (cancelled) return;
      console.error('Failed to load table state:', err);
      const status = parseInt(err?.message?.match(/HTTP (\d+)/)?.[1] || '0', 10);
      const accessErr = tableAccessErrorAfterFetch({ ok: false, httpStatus: status });
      if (accessErr === 'private' || accessErr === 'not-found') {
        setTableOwnerUid(null);
        setTableAccessError(accessErr);
        setTableStateReady(true);
        tableStateReadyRef.current = true;
      }
    });
    return () => { cancelled = true; };
  }, [loading, user?.uid, route.view, route.tableId]);

  // GM SSE: receive player presence, table state snapshots, banners, and dice roll events
  useEffect(() => {
    if (!user || route.view !== 'table' || isPlayer || isSpectator) return;
    if (!shouldStartGmTableRoomEffects({
      routeTableId: route.tableId,
      userUid: user.uid,
      tableOwnerUid,
    })) return;
    const tableId = route.tableId || user.uid;
    let es;
    let reconnectTimer;
    const connect = async () => {
      const token = await getAuthToken();
      if (!token || !userRef.current) return;
      es = new EventSource(`/api/room/my/players?token=${encodeURIComponent(token)}&tableId=${encodeURIComponent(tableId)}`);
      es.addEventListener('presence', (e) => {
        const data = JSON.parse(e.data);
        setConnectedPlayers(data.players || []);
        if (typeof data.audienceOnlineCount === 'number') setAudienceOnlineCount(data.audienceOnlineCount);
      });
      // Server-authoritative table state snapshot (replaces state/table-op/character-* events)
      es.addEventListener('table_state', (e) => {
        const state = JSON.parse(e.data);
        if (!state) return;
        if (Array.isArray(state.elements)) {
          setActiveElements(prev => reconcileElementsById(prev, state.elements));
        }
        if (state.fearCount != null) setFearCount(state.fearCount);
        setPartyLoot(normalizePartyLoot(state.partyLoot));
        if (state.spotlight) setSpotlight(state.spotlight);
        else setSpotlight(null);
        if (Array.isArray(state.conditionsHistory)) setConditionsHistory(state.conditionsHistory);
        if (state.featureCountdowns != null) setFeatureCountdowns(state.featureCountdowns);
        if (Array.isArray(state.sessionCountdowns)) setSessionCountdowns(state.sessionCountdowns);
        if (state.tableBattleMods != null) setTableBattleMods(state.tableBattleMods);
        setNextScenes(Array.isArray(state.nextScenes) ? state.nextScenes : []);
        if (Array.isArray(state.playerEmails)) setPlayerEmails(state.playerEmails);
        if (state.playerNames != null && typeof state.playerNames === 'object') setPlayerNames(state.playerNames);
        setInviteLink(state.inviteLink ?? null);
        if (state.tableName != null) {
          setTableName(state.tableName);
          setMyTables(prev => prev.map(t => t.id === tableId ? { ...t, name: state.tableName } : t));
        }
        if (state.isPublic != null) setTableIsPublic(state.isPublic === true);
        if (state.gmDisplayName != null) setTableGmDisplayName(state.gmDisplayName);
        if (state.mapConfig != null && typeof state.mapConfig === 'object') {
          const merged = { ...DEFAULT_MAP_CONFIG, ...state.mapConfig };
          setMapConfig(prev => reconcileMapConfig(prev, merged));
        }
        if (Array.isArray(state.maps)) setMaps(prev => reconcileMapsById(prev, state.maps));
        else setMaps([]);
        if (state.activeMapId != null) setActiveMapId(state.activeMapId);
        else setActiveMapId(null);
        if (state.gmMapView != null && typeof state.gmMapView === 'object') {
          setGmMapView(state.gmMapView);
        } else {
          setGmMapView(null);
        }
        if (Array.isArray(state.mapViews)) setMapViews(prev => reconcileMapViewsById(prev, state.mapViews));
        else setMapViews([]);
        if (state.gmActiveViewId != null) setGmActiveViewId(state.gmActiveViewId);
        else setGmActiveViewId(null);
        if (state.playerMapViewFocus != null && typeof state.playerMapViewFocus === 'object') {
          setPlayerMapViewFocus(state.playerMapViewFocus);
        } else {
          setPlayerMapViewFocus(null);
        }
        if (state.lifeSupportSelections != null) setLifeSupportSelections(state.lifeSupportSelections);
        if (state.restMovesSelections != null) setRestMovesSelections(state.restMovesSelections);
        if (state.featureState != null && typeof state.featureState === 'object') {
          setTableFeatureState(state.featureState);
        } else {
          setTableFeatureState({});
        }
        if (state.top != null && typeof state.top === 'object') {
          setTableTop(state.top);
        } else {
          setTableTop(null);
        }
        setTableStateReady(true);
        tableStateReadyRef.current = true;
      });
      es.addEventListener('roll-history', (e) => {
        const { rolls } = JSON.parse(e.data);
        if (Array.isArray(rolls) && rolls.length) {
          rolls.forEach(r => { if (r._rollDbId) seenLogDbIdsRef.current.add(r._rollDbId); });
          setActionLog(rolls.map(r => ({ ...r, _logId: r._logId || `hist-${r.timestamp || Math.random()}` })));
        }
      });
      es.addEventListener('banners', (e) => {
        const data = JSON.parse(e.data);
        setPendingBanners(Array.isArray(data) ? data.map(normalizeRoll) : data);
      });
      es.addEventListener('roll-log-append', (e) => {
        try {
          const { roll } = JSON.parse(e.data);
          const id = roll?._rollDbId;
          if (!id || seenLogDbIdsRef.current.has(id)) return;
          seenLogDbIdsRef.current.add(id);
          setActionLog(prev => [...prev.slice(-49), { ...normalizeRoll(roll), _logId: `log-${id}` }]);
        } catch { /* ignore */ }
      });
      es.addEventListener('intent', (e) => {
        const intent = JSON.parse(e.data);
        setPendingPlayerIntent(intent); // null clears the banner
      });
      es.addEventListener('spotlight-request-granted', handleSpotlightRequestGrantedEvent);
      es.addEventListener('map_ping', (e) => {
        try {
          const p = JSON.parse(e.data);
          if (!p?.id) return;
          appendMapPing(p);
        } catch { /* ignore */ }
      });
      es.addEventListener('map_scribble', (e) => {
        try {
          const s = JSON.parse(e.data);
          if (!s?.id) return;
          appendMapScribble(s);
        } catch { /* ignore */ }
      });
      es.onerror = () => { es.close(); reconnectTimer = setTimeout(connect, 3000); };
    };
    connect();
    postTableOp({ op: 'set-gm-display-name', gmDisplayName: user?.displayName || '' }, tableId);
    return () => { es?.close(); if (reconnectTimer) clearTimeout(reconnectTimer); };
  }, [user?.uid, route.view, route.tableId, isPlayer, isSpectator, tableOwnerUid, appendMapPing, appendMapScribble, handleSpotlightRequestGrantedEvent]);

  // Player SSE: receive table state snapshots, banners, and dice roll events for the invited table
  useEffect(() => {
    if (!isPlayer || isSpectator || !user || !route.tableId) return;
    let es;
    let reconnectTimer;
    const connect = async () => {
      const token = await getAuthToken();
      if (!token || !userRef.current) return;
      es = new EventSource(`/api/room/${route.tableId}/stream?token=${encodeURIComponent(token)}`);
      es.addEventListener('presence', (e) => {
        const data = JSON.parse(e.data);
        setConnectedPlayers(data.players || []);
        if (typeof data.audienceOnlineCount === 'number') setAudienceOnlineCount(data.audienceOnlineCount);
      });
      // Server-authoritative table state snapshot (replaces state/table-op/character-* events)
      es.addEventListener('table_state', (e) => {
        const state = JSON.parse(e.data);
        if (!state) return;
        if (Array.isArray(state.elements)) {
          setActiveElements(prev => reconcileElementsById(prev, state.elements));
        }
        if (state.fearCount != null) setFearCount(state.fearCount);
        setPartyLoot(normalizePartyLoot(state.partyLoot));
        if (state.spotlight) setSpotlight(state.spotlight);
        else setSpotlight(null);
        if (Array.isArray(state.conditionsHistory)) setConditionsHistory(state.conditionsHistory);
        if (state.featureCountdowns != null) setFeatureCountdowns(state.featureCountdowns);
        if (Array.isArray(state.sessionCountdowns)) setSessionCountdowns(state.sessionCountdowns);
        if (state.tableBattleMods != null) setTableBattleMods(state.tableBattleMods);
        setNextScenes(Array.isArray(state.nextScenes) ? state.nextScenes : []);
        if (Array.isArray(state.playerEmails)) setPlayerEmails(state.playerEmails);
        if (state.playerNames != null && typeof state.playerNames === 'object') setPlayerNames(state.playerNames);
        setInviteLink(state.inviteLink ?? null);
        if (state.tableName != null) setTableName(state.tableName);
        if (state.isPublic != null) setTableIsPublic(state.isPublic === true);
        if (state.mapConfig != null && typeof state.mapConfig === 'object') {
          const merged = { ...DEFAULT_MAP_CONFIG, ...state.mapConfig };
          setMapConfig(prev => reconcileMapConfig(prev, merged));
        }
        if (Array.isArray(state.maps)) setMaps(prev => reconcileMapsById(prev, state.maps));
        else setMaps([]);
        if (state.activeMapId != null) setActiveMapId(state.activeMapId);
        else setActiveMapId(null);
        if (state.gmMapView != null && typeof state.gmMapView === 'object') {
          setGmMapView(state.gmMapView);
        } else {
          setGmMapView(null);
        }
        if (Array.isArray(state.mapViews)) setMapViews(prev => reconcileMapViewsById(prev, state.mapViews));
        else setMapViews([]);
        if (state.gmActiveViewId != null) setGmActiveViewId(state.gmActiveViewId);
        else setGmActiveViewId(null);
        if (state.playerMapViewFocus != null && typeof state.playerMapViewFocus === 'object') {
          setPlayerMapViewFocus(state.playerMapViewFocus);
        } else {
          setPlayerMapViewFocus(null);
        }
        if (state.lifeSupportSelections != null) setLifeSupportSelections(state.lifeSupportSelections);
        if (state.restMovesSelections != null) setRestMovesSelections(state.restMovesSelections);
        if (state.featureState != null && typeof state.featureState === 'object') {
          setTableFeatureState(state.featureState);
        } else {
          setTableFeatureState({});
        }
        if (state.top != null && typeof state.top === 'object') {
          setTableTop(state.top);
        } else {
          setTableTop(null);
        }
        setTableStateReady(true);
        setMyRooms(prev => {
          const hasRoom = prev.some(r => r.tableId === route.tableId);
          if (hasRoom && state.tableName != null)
            return prev.map(r => r.tableId === route.tableId ? { ...r, tableName: state.tableName || '' } : r);
          if (!hasRoom)
            return [...prev, { tableId: route.tableId, gmUid: tableOwnerUid ?? '', gmName: state.gmDisplayName || '', tableName: state.tableName || '' }];
          return prev;
        });
        tableStateReadyRef.current = true;
      });
      es.addEventListener('roll-history', (e) => {
        const { rolls } = JSON.parse(e.data);
        if (Array.isArray(rolls) && rolls.length) {
          rolls.forEach(r => { if (r._rollDbId) seenLogDbIdsRef.current.add(r._rollDbId); });
          setActionLog(rolls.map(r => ({ ...r, _logId: r._logId || `hist-${r.timestamp || Math.random()}` })));
        }
      });
      es.addEventListener('banners', (e) => {
        const data = JSON.parse(e.data);
        setPendingBanners(Array.isArray(data) ? data.map(normalizeRoll) : data);
      });
      es.addEventListener('roll-log-append', (e) => {
        try {
          const { roll } = JSON.parse(e.data);
          const id = roll?._rollDbId;
          if (!id || seenLogDbIdsRef.current.has(id)) return;
          seenLogDbIdsRef.current.add(id);
          setActionLog(prev => [...prev.slice(-49), { ...normalizeRoll(roll), _logId: `log-${id}` }]);
        } catch { /* ignore */ }
      });
      es.addEventListener('intent', (e) => {
        try {
          setIntentDifficultyUpdate(JSON.parse(e.data));
        } catch { /* ignore */ }
      });
      es.addEventListener('spotlight-request-granted', handleSpotlightRequestGrantedEvent);
      es.addEventListener('map_ping', (e) => {
        try {
          const p = JSON.parse(e.data);
          if (!p?.id) return;
          appendMapPing(p);
        } catch { /* ignore */ }
      });
      es.addEventListener('map_scribble', (e) => {
        try {
          const s = JSON.parse(e.data);
          if (!s?.id) return;
          appendMapScribble(s);
        } catch { /* ignore */ }
      });
      es.onerror = () => { es.close(); reconnectTimer = setTimeout(connect, 3000); };
    };
    connect();
    return () => { es?.close(); if (reconnectTimer) clearTimeout(reconnectTimer); };
  }, [isPlayer, isSpectator, user?.uid, route.tableId, tableOwnerUid, appendMapPing, appendMapScribble, handleSpotlightRequestGrantedEvent]);

  // Spectator SSE: public tables (signed-in or anonymous)
  useEffect(() => {
    if (!isSpectator || !route.tableId) return;
    let es;
    let reconnectTimer;
    const connect = async () => {
      const token = await getAuthToken();
      const qs = token ? `?token=${encodeURIComponent(token)}` : '';
      es = new EventSource(`/api/room/${route.tableId}/public-stream${qs}`);
      es.addEventListener('presence', (e) => {
        const data = JSON.parse(e.data);
        setConnectedPlayers(data.players || []);
        if (typeof data.audienceOnlineCount === 'number') setAudienceOnlineCount(data.audienceOnlineCount);
      });
      es.addEventListener('table_state', (e) => {
        const state = JSON.parse(e.data);
        if (!state) return;
        if (Array.isArray(state.elements)) {
          setActiveElements(prev => reconcileElementsById(prev, state.elements));
        }
        if (state.fearCount != null) setFearCount(state.fearCount);
        setPartyLoot(normalizePartyLoot(state.partyLoot));
        if (state.spotlight) setSpotlight(state.spotlight);
        else setSpotlight(null);
        if (Array.isArray(state.conditionsHistory)) setConditionsHistory(state.conditionsHistory);
        if (state.featureCountdowns != null) setFeatureCountdowns(state.featureCountdowns);
        if (Array.isArray(state.sessionCountdowns)) setSessionCountdowns(state.sessionCountdowns);
        if (state.tableBattleMods != null) setTableBattleMods(state.tableBattleMods);
        setNextScenes(Array.isArray(state.nextScenes) ? state.nextScenes : []);
        if (Array.isArray(state.playerEmails)) setPlayerEmails(state.playerEmails);
        setInviteLink(state.inviteLink ?? null);
        if (state.tableName != null) setTableName(state.tableName);
        if (state.isPublic != null) setTableIsPublic(state.isPublic === true);
        if (state.mapConfig != null && typeof state.mapConfig === 'object') {
          const merged = { ...DEFAULT_MAP_CONFIG, ...state.mapConfig };
          setMapConfig(prev => reconcileMapConfig(prev, merged));
        }
        if (Array.isArray(state.maps)) setMaps(prev => reconcileMapsById(prev, state.maps));
        else setMaps([]);
        if (state.activeMapId != null) setActiveMapId(state.activeMapId);
        else setActiveMapId(null);
        if (state.gmMapView != null && typeof state.gmMapView === 'object') {
          setGmMapView(state.gmMapView);
        } else {
          setGmMapView(null);
        }
        if (Array.isArray(state.mapViews)) setMapViews(prev => reconcileMapViewsById(prev, state.mapViews));
        else setMapViews([]);
        if (state.gmActiveViewId != null) setGmActiveViewId(state.gmActiveViewId);
        else setGmActiveViewId(null);
        if (state.playerMapViewFocus != null && typeof state.playerMapViewFocus === 'object') {
          setPlayerMapViewFocus(state.playerMapViewFocus);
        } else {
          setPlayerMapViewFocus(null);
        }
        if (state.lifeSupportSelections != null) setLifeSupportSelections(state.lifeSupportSelections);
        if (state.restMovesSelections != null) setRestMovesSelections(state.restMovesSelections);
        if (state.featureState != null && typeof state.featureState === 'object') {
          setTableFeatureState(state.featureState);
        } else {
          setTableFeatureState({});
        }
        if (state.top != null && typeof state.top === 'object') {
          setTableTop(state.top);
        } else {
          setTableTop(null);
        }
        setTableStateReady(true);
        tableStateReadyRef.current = true;
      });
      es.addEventListener('roll-history', (e) => {
        const { rolls } = JSON.parse(e.data);
        if (Array.isArray(rolls) && rolls.length) {
          rolls.forEach(r => { if (r._rollDbId) seenLogDbIdsRef.current.add(r._rollDbId); });
          setActionLog(rolls.map(r => ({ ...r, _logId: r._logId || `hist-${r.timestamp || Math.random()}` })));
        }
      });
      es.addEventListener('banners', (e) => {
        const data = JSON.parse(e.data);
        setPendingBanners(Array.isArray(data) ? data.map(normalizeRoll) : data);
      });
      es.addEventListener('roll-log-append', (e) => {
        try {
          const { roll } = JSON.parse(e.data);
          const id = roll?._rollDbId;
          if (!id || seenLogDbIdsRef.current.has(id)) return;
          seenLogDbIdsRef.current.add(id);
          setActionLog(prev => [...prev.slice(-49), { ...normalizeRoll(roll), _logId: `log-${id}` }]);
        } catch { /* ignore */ }
      });
      es.addEventListener('map_ping', (e) => {
        try {
          const p = JSON.parse(e.data);
          if (!p?.id) return;
          appendMapPing(p);
        } catch { /* ignore */ }
      });
      es.addEventListener('map_scribble', (e) => {
        try {
          const s = JSON.parse(e.data);
          if (!s?.id) return;
          appendMapScribble(s);
        } catch { /* ignore */ }
      });
      es.onerror = () => { es.close(); reconnectTimer = setTimeout(connect, 3000); };
    };
    connect();
    return () => { es?.close(); if (reconnectTimer) clearTimeout(reconnectTimer); };
  }, [isSpectator, route.tableId, appendMapPing, appendMapScribble]);

  // Drive Action Log live updates from the pendingBanners subscription channel and
  // roll-log-append (acknowledged-only action rows that skip the pending banner queue).
  // roll-history seeds seenLogDbIdsRef on connect; here we append any newly-arriving
  // banners that have not yet been added to the log.
  useEffect(() => {
    for (const banner of pendingBanners) {
      const id = banner._rollDbId;
      if (!id || seenLogDbIdsRef.current.has(id)) continue;
      seenLogDbIdsRef.current.add(id);
      setActionLog(prev => [...prev.slice(-49), { ...banner, _logId: `ban-${id}` }]);
    }
  }, [pendingBanners]);

  useEffect(() => {
    sessionCountdownAutomationRollsRef.current.clear();
  }, [route.tableId]);

  // GM: auto-advance session countdowns (standard + dynamic) when a PC action roll lands in pending banners.
  useEffect(() => {
    if (effectiveIsPlayer || route.view !== 'table') return;
    const tid = route.tableId || user?.uid;
    if (!tid || !pendingBanners?.length) return;
    for (const roll of pendingBanners) {
      const rid = roll._rollDbId;
      if (!rid || sessionCountdownAutomationRollsRef.current.has(rid)) continue;
      const batch = computeSessionCountdownUpdatesFromRoll(sessionCountdowns, roll, activeElements);
      if (!batch?.updates?.length) continue;
      sessionCountdownAutomationRollsRef.current.add(rid);
      postTableOp({ op: 'session-countdown-batch', updates: batch.updates }, tid);
    }
  }, [pendingBanners, sessionCountdowns, activeElements, effectiveIsPlayer, route.view, route.tableId, user?.uid]);

  const minionReconcileRef = useRef({ tableId: null, count: null });
  useEffect(() => {
    if (effectiveIsPlayer || route.view !== 'table' || !tableStateReady) return;
    const tid = route.tableId;
    if (!tid) return;
    if (minionReconcileRef.current.tableId !== tid) {
      minionReconcileRef.current = { tableId: tid, count: null };
    }
    const characterCount = characterCountFromElements(activeElements);
    const prevCount = minionReconcileRef.current.count;
    const justChanged = prevCount !== null && prevCount !== characterCount;
    minionReconcileRef.current.count = characterCount;
    if (characterCount < 1 && !justChanged) return;
    const plan = planMinionGroupReconcile(activeElements, characterCount);
    if (!plan.add.length && !plan.removeInstanceIds.length && !plan.stashUpdates.length) return;
    setActiveElements((prev) => applyMinionGroupReconcilePlan(prev, plan));
    if (plan.add.length) postTableOp({ op: 'add-elements', elements: plan.add }, tid);
    for (const instanceId of plan.removeInstanceIds) {
      postTableOp({ op: 'remove-element', instanceId }, tid);
    }
    if (plan.stashUpdates.length) {
      postTableOp({
        op: 'update-elements',
        updates: plan.stashUpdates.map((row) => ({
          instanceId: row.instanceId,
          updates: { minionGroupParkedPlacements: row.minionGroupParkedPlacements },
        })),
      }, tid);
    }
  }, [activeElements, effectiveIsPlayer, route.view, route.tableId, tableStateReady]);

  // Remember last library tab so we can return there when navigating back from Game Table
  useEffect(() => {
    if (route.view === 'library' && route.tab) {
      lastLibraryPathRef.current = `${window.location.pathname}${window.location.search || ''}`;
    }
  }, [route.view, route.tab]);

  /** Called by LibraryView whenever its hook fetches a new page of a paginated collection
   *  (adversaries/environments/scenes). Merges with previously resolved items (from
   *  fetchAllCollections) so ItemCard and picker lookups elsewhere keep working. */
  const syncDataToApp = (collection, items) => {
    setData(prev => {
      const newIds = new Set(items.map(i => i.id));
      const extras = (prev[collection] || []).filter(i => !newIds.has(i.id));
      return { ...prev, [collection]: [...items, ...extras] };
    });
  };

  /** Merge an adversary into app data so BP calculation can resolve it (e.g. when added via scene picker). */
  const mergeAdversaryIntoData = useCallback((adv) => {
    if (!adv?.id) return;
    setData(prev => {
      const list = prev.adversaries || [];
      const existing = list.findIndex(a => a.id === adv.id);
      const updated = existing >= 0 ? list.map(a => (a.id === adv.id ? adv : a)) : [...list, adv];
      return { ...prev, adversaries: updated };
    });
  }, []);

  const saveGenerationRef = useRef(0);
  const lastSaveGenRef = useRef({});

  const saveImage = async (collectionName, id, imageUrl, opts) => {
    try {
      return await apiSaveImage(collectionName, id, imageUrl, opts);
    } catch (err) {
      // Previously silent (console.error only) — a failed image save (e.g. a large pasted
      // screenshot hitting a network/proxy size limit) left the editor showing the image from
      // local state while the library record never actually persisted it, so it never appeared
      // on tokens/sheets elsewhere with no indication anything went wrong. Surface it.
      console.error(`saveImage(${collectionName}, ${id}) failed:`, err);
      alert(`Failed to save image: ${err.message || err}. It may be too large — try a smaller image.`);
    }
  };

  const saveItem = async (collectionName, item) => {
    const key = `${collectionName}:${item?.id ?? 'new'}`;
    const gen = ++saveGenerationRef.current;
    lastSaveGenRef.current[key] = gen;
    try {
      const saved = await apiSaveItem(collectionName, item);
      if (!saved) return;
      const savedKey = `${collectionName}:${saved.id}`;
      if (item?.id != null && lastSaveGenRef.current[savedKey] !== gen) return saved;
      // Optimistically update non-paginated collections in local data state.
      // Paginated collections (adversaries/environments) are refreshed by LibraryView's hook.
      if (NON_PAGINATED_COLLECTIONS.includes(collectionName)) {
        setData(prev => {
          const existing = prev[collectionName].findIndex(i => i.id === saved.id);
          const updated = existing >= 0
            ? prev[collectionName].map(i => i.id === saved.id ? saved : i)
            : [...prev[collectionName], saved];
          return { ...prev, [collectionName]: updated };
        });
      }
      // Mirror server `character-library-update` so sidebar cards + sheet stay in sync without waiting for SSE.
      if (collectionName === 'characters' && saved?.id) {
        setActiveElements(prev => {
          const result = applyTableOp(
            { op: 'character-library-update', characterId: saved.id, newBaseData: saved },
            { activeElements: prev },
          );
          return result.activeElements ?? prev;
        });
      }
      // Same idea as characters: merge authoritative library row into table elements by id (Encounter panel
      // reads activeElements, not data.adversaries). Uses server `saved`, not client form payload.
      if ((collectionName === 'adversaries' || collectionName === 'environments') && saved?.id) {
        setActiveElements(prev => {
          const result = applyTableOp(
            { op: 'update-base-data', elementId: saved.id, newBaseData: saved },
            { activeElements: prev },
          );
          return result.activeElements ?? prev;
        });
      }
      return saved;
    } catch (err) {
      console.error(`saveItem(${collectionName}) failed:`, err);
    }
  };

  const deleteItem = async (collectionName, id) => {
    try {
      await apiDeleteItem(collectionName, id);
      // Remove from non-paginated collections immediately; paginated ones refresh via hook.
      if (NON_PAGINATED_COLLECTIONS.includes(collectionName)) {
        setData(prev => ({
          ...prev,
          [collectionName]: prev[collectionName].filter(i => i.id !== id),
        }));
      }
    } catch (err) {
      console.error(`deleteItem(${collectionName}, ${id}) failed:`, err);
    }
  };

  const cloneItem = async (collectionName, item) => {
    // LibraryView's hook will refresh after clone via handleClone → search.refresh().
    return cloneItemToLibrary(collectionName, item, { play: false });
  };

  const updateActiveElementsBaseData = (predicate, newBaseData) => {
    setActiveElements(prev => prev.map(el => {
      if (!predicate(el)) return el;
      const runtime = {};
      UPDATE_BASE_DATA_RUNTIME_KEYS.forEach(k => { if (k in el) runtime[k] = el[k]; });
      Object.keys(el).forEach(k => { if (k.startsWith('_') && k in el) runtime[k] = el[k]; });
      return { ...newBaseData, ...runtime };
    }));
  };

  const doAddToTable = async (item, collectionName, explicitTargetTableId, opts = {}) => {
    const newElements = [];

    if (collectionName === 'adversaries' || collectionName === 'environments') {
      let tableItem = item;
      if (isOwnItem(item)) {
        // Own item: just record the play
        recordPlay(collectionName, item.id).catch(err => console.warn('recordPlay failed:', err));
      } else if (shouldCloneOnAddToTable(collectionName, item)) {
        // Non-own item: auto-clone into library (find-or-create) and record play
        try {
          tableItem = await cloneItemToLibrary(collectionName, item, { play: true });
        } catch (err) {
          console.warn('Auto-clone failed, using original:', err);
          tableItem = item;
        }
        // Add/update clone in local state so library reflects it immediately
        if (tableItem && tableItem.id !== item.id) {
          setData(prev => {
            const list = prev[collectionName] || [];
            const existing = list.findIndex(i => i.id === tableItem.id);
            const updated = existing >= 0
              ? list.map(i => i.id === tableItem.id ? tableItem : i)
              : [...list, tableItem];
            return { ...prev, [collectionName]: updated };
          });
        }
      }
      if (collectionName === 'adversaries') {
        newElements.push(...buildLibraryAdversaryElements(tableItem, {
          characterCount: characterCountFromElements(activeElements),
          copies: opts.copies,
        }));
      } else {
        newElements.push({ ...tableItem, instanceId: generateId(), elementType: 'environment' });
      }
    } else if (collectionName === 'maps') {
      let tableItem = item;
      if (isOwnItem(item)) {
        recordPlay('maps', item.id).catch(err => console.warn('recordPlay failed:', err));
      } else if (shouldCloneOnAddToTable(collectionName, item)) {
        try {
          tableItem = await cloneItemToLibrary(collectionName, item, { play: true });
        } catch (err) {
          console.warn('Auto-clone failed, using original:', err);
          tableItem = item;
        }
      }
      const target = resolveTargetTableId(explicitTargetTableId);
      await postTableOp(buildAddMapOpFromLibraryItem(tableItem), target);
      return [];
    } else if (collectionName === 'scenes') {
      // Scenes are value-semantic snapshots — place onto the table without
      // cloning into the user's library (own or SRD/public).
      if (isOwnItem(item)) {
        recordPlay('scenes', item.id).catch(err => console.warn('recordPlay failed:', err));
      }
      let sceneForPlace = item;
      const libIds = (item.maps || []).map((m) => m.libraryMapId).filter(Boolean);
      if (libIds.length) {
        try {
          const resolved = await resolveItems({ maps: libIds });
          const byId = new Map();
          for (const raw of resolved.maps || []) {
            if (!raw?.id) continue;
            let lib = raw;
            if (shouldCloneOnAddToTable('maps', lib)) {
              try { lib = await cloneItemToLibrary('maps', lib, { play: false }); } catch { /* keep catalog row */ }
            }
            byId.set(raw.id, lib);
            if (lib.id && lib.id !== raw.id) byId.set(lib.id, lib);
          }
          sceneForPlace = applyLibraryArtToSceneMaps(item, byId);
        } catch (err) {
          console.warn('Resolve scene library maps failed; using embedded art', err);
        }
      }
      const remapped = regenerateSceneIdsForTablePlacement(sceneForPlace);
      const target = resolveTargetTableId(explicitTargetTableId);
      const snapshotOp = buildSceneSnapshotTableOp({
        mode: opts.replaceScene ? 'replace' : 'add',
        remapped,
        applySceneBattleMods: opts.applySceneBattleMods,
        scene: item,
      });
      await postTableOp(snapshotOp, target);
      return [];
    } else if (collectionName === 'notes') {
      const id = item.id || generateId();
      newElements.push({
        instanceId: generateId(),
        elementType: 'note',
        id,
        name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Note',
        body: typeof item.body === 'string' ? item.body : '',
        ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
      });
    } else if (collectionName === 'characters') {
      const { is_public, _source, ...charData } = item;
      const maxH = charData.maxHope ?? 6;
      const hopeVal =
        charData.hope != null ? charData.hope : Math.min(DEFAULT_CHARACTER_STARTING_HOPE, maxH);
      newElements.push({ ...charData, hope: hopeVal, instanceId: generateId(), elementType: 'character' });
    } else if (collectionName === 'adventures') {
      const envIds = (item.environments || [])
        .map((e) => (typeof e === 'string' ? e : e?.id))
        .filter(Boolean);
      const advRefs = (item.adversaries || []).map((ref) => {
        if (ref == null) return null;
        if (typeof ref === 'string') return { id: ref, count: 1 };
        const id = ref.id || ref.adversaryId;
        if (!id) return null;
        return { id, count: ref.count || 1 };
      }).filter(Boolean);
      const advIds = advRefs.map((r) => r.id);
      const resolved = (advIds.length || envIds.length)
        ? await resolveItems({ adversaries: advIds, environments: envIds }, { adopt: true })
        : { adversaries: [], environments: [] };
      const adversariesById = Object.fromEntries((resolved.adversaries || []).map((a) => [a.id, a]));
      const environmentsById = Object.fromEntries((resolved.environments || []).map((e) => [e.id, e]));
      for (const envId of envIds) {
        const tableItem = environmentsById[envId];
        if (tableItem) newElements.push({ ...tableItem, instanceId: generateId(), elementType: 'environment' });
      }
      for (const { id, count } of advRefs) {
        const tableItem = adversariesById[id];
        if (!tableItem) continue;
        for (let i = 0; i < count; i++) {
          newElements.push({
            ...tableItem,
            instanceId: generateId(),
            elementType: 'adversary',
            currentHp: tableItem.hp_max || 0,
            currentStress: 0,
            conditions: '',
          });
        }
      }
    }

    const target = resolveTargetTableId(explicitTargetTableId);
    const r = routeRef.current;
    if (r?.view === 'table' && r.tableId === target) {
      setActiveElements(prev => [...prev, ...newElements]);
    }
    return newElements;
  };

  /** Resolves which `table_state` row receives an add (explicit pick, current table route, or legacy primary uid). */
  function resolveTargetTableId(explicitTargetTableId) {
    if (explicitTargetTableId != null && explicitTargetTableId !== '') return explicitTargetTableId;
    const r = routeRef.current;
    if (r?.view === 'table' && r.tableId) return r.tableId;
    return userRef.current?.uid;
  }

  const removeActiveElement = (instanceId) => {
    setActiveElements(prev => prev.filter(el => el.instanceId !== instanceId));
  };

  const clearTable = () => {
    setActiveElements(prev => prev.filter(el => el.elementType === 'character'));
    setFeatureCountdowns({});
  };

  // --- Table op dispatchers ---
  // These call postTableOp (which POSTs to /api/room/my/op). The server applies the op to the
  // DB state and notifies all subscribers. Token positions and conditions text are applied
  // optimistically so the UI stays responsive; the next table_state snapshot confirms.
  const tableId = route.view === 'table' ? route.tableId : user?.uid;

  const sessionPlayAllowed = useMemo(
    () => isTablePlayAllowed(tableTop == null ? {} : { top: tableTop }),
    [tableTop]
  );
  const sessionStarted = tableTop == null ? true : tableTop.sessionStarted !== false;
  const sessionPaused = tableTop?.sessionPaused === true;

  const handleSessionBannerResume = useCallback(() => {
    if (effectiveIsPlayer || !sessionPaused) return;
    postTableOp(
      { op: 'set-table-top', top: { sessionPaused: false, lastPlayActivityAt: Date.now() } },
      tableId,
    );
  }, [effectiveIsPlayer, sessionPaused, tableId]);

  const sendUpdateActiveElement = (instanceId, updates, options = {}) => {
    if (shouldOptimisticallyPatch(updates)) {
      setActiveElements(prev => prev.map(el => el.instanceId === instanceId ? { ...el, ...updates } : el));
    }
    const op = { op: 'update-element', instanceId, updates };
    if (options.bypassPrepGate) op.bypassPrepGate = true;
    postTableOp(op, tableId);
  };

  const sendRemoveActiveElement = (instanceId) => {
    setActiveElements(prev => prev.filter(el => el.instanceId !== instanceId));
    postTableOp({ op: 'remove-element', instanceId }, tableId);
  };

  const sendSetFearCount = (valueOrFn) => {
    const resolved = typeof valueOrFn === 'function' ? valueOrFn(fearCount) : valueOrFn;
    setFearCount(resolved);
    postTableOp({ op: 'set-fear', fearCount: resolved }, tableId);
  };

  const sendSetPartyLoot = (patch, options = {}) => {
    const next = normalizePartyLoot({
      ...partyLoot,
      ...(patch && typeof patch === 'object' ? patch : {}),
    });
    setPartyLoot(next);
    const op = { op: 'set-party-loot' };
    if (patch && typeof patch === 'object') {
      if ('gold' in patch) op.gold = next.gold;
      if ('inventory' in patch) op.inventory = next.inventory;
    }
    if (options.bypassPrepGate) op.bypassPrepGate = true;
    postTableOp(op, tableId);
  };

  const sendMoveInventoryItem = (move, options = {}) => {
    const patch = applyInventoryMove({ activeElements, partyLoot }, move);
    if (!patch.partyLoot && !patch.activeElements) return;
    if (patch.partyLoot) setPartyLoot(patch.partyLoot);
    if (patch.activeElements) setActiveElements(patch.activeElements);
    const op = { op: 'move-inventory-item', from: move.from, to: move.to, uid: move.uid };
    if (options.bypassPrepGate) op.bypassPrepGate = true;
    postTableOp(op, tableId);
  };

  const sendSetSpotlight = (next) => {
    setSpotlight(next);
    postTableOp({ op: 'set-spotlight', spotlight: next }, tableId);
  };

  const sendAddConditionsHistoryEntry = useCallback((entry) => {
    setConditionsHistory((prev) => addConditionsHistoryEntry(prev, entry));
    postTableOp({ op: 'add-conditions-history-entry', entry }, tableId);
  }, [tableId]);

  const sendRemoveConditionsHistoryEntry = useCallback((entry) => {
    setConditionsHistory((prev) => removeConditionsHistoryEntry(prev, entry));
    postTableOp({ op: 'remove-conditions-history-entry', entry }, tableId);
  }, [tableId]);

  const sendSetTableName = (valueOrFn) => {
    const resolved = typeof valueOrFn === 'function' ? valueOrFn(tableName) : valueOrFn;
    const name = resolved ?? '';
    postTableOp({ op: 'set-table-name', tableName: name }, tableId);
    setTableName(name);
    setMyTables(prev => prev.map(t => t.id === tableId ? { ...t, name } : t));
  };

  const sendSetTablePublic = (isPublic) => {
    const next = isPublic === true;
    postTableOp({ op: 'set-table-public', isPublic: next }, tableId);
    setTableIsPublic(next);
  };

  const sendSetTableBattleMods = (valueOrFn) => {
    const resolved = typeof valueOrFn === 'function' ? valueOrFn(tableBattleMods) : valueOrFn;
    postTableOp({ op: 'set-battle-mods', tableBattleMods: resolved }, tableId);
  };

  const sendGenerateInviteLink = async () => {
    try {
      const result = await postGenerateInviteLink(tableId);
      setInviteLink(result);
    } catch (err) {
      console.error('Failed to generate invite link:', err);
    }
  };

  const sendRevokeInviteLink = async () => {
    try {
      await postRevokeInviteLink(tableId);
      setInviteLink(null);
    } catch (err) {
      console.error('Failed to revoke invite link:', err);
    }
  };

  const sendRemovePlayerEmail = (email) => {
    postTableOp({ op: 'remove-player-email', email }, tableId);
    setPlayerEmails(prev => prev.filter(e => e.toLowerCase() !== email.toLowerCase()));
  };

  const sendLeaveTable = async () => {
    try {
      await postLeaveTable(tableId);
      setMyRooms(prev => prev.filter(r => r.tableId !== tableId));
      navigate('/');
    } catch (err) {
      console.error('Failed to leave table:', err);
      alert('Failed to leave the table. Please try again.');
    }
  };

  const sendUpdateCountdown = (cardKey, featureKey, cdIdx, value) => {
    const key = `${cardKey}|${featureKey}|${cdIdx}`;
    postTableOp({ op: 'set-countdown', key, value }, tableId);
  };

  const sendClearTable = () => {
    postTableOp({ op: 'clear-table' }, tableId);
  };

  const sendAddElements = (elements) => {
    if (!elements?.length) return;
    setActiveElements((prev) => [...prev, ...elements]);
    postTableOp({ op: 'add-elements', elements }, tableId);
  };

  const sendDoAddToTable = async (item, collectionName, targetTableId, opts) => {
    const target = resolveTargetTableId(targetTableId);
    const newElements = await doAddToTable(item, collectionName, targetTableId, opts);
    if (newElements?.length) postTableOp({ op: 'add-elements', elements: newElements }, target);
    return newElements;
  };

  const sendAddToTable = (item, collectionName, targetTableId, opts) => {
    if (shouldOfferReplaceOrAdd(collectionName)) {
      setPendingSceneAdd({
        scene: item,
        moreScenes: Array.isArray(opts?.moreScenes) ? opts.moreScenes : [],
        targetTableId: resolveTargetTableId(targetTableId),
      });
      return;
    }
    return sendDoAddToTable(item, collectionName, targetTableId, opts);
  };

  const sendUpdateActiveElementsBaseData = (predicate, newBaseData) => {
    const matching = activeElements.find(predicate);
    if (!matching) return;
    // Optimistic merge (same rules as server applyTableOp update-base-data) so Encounter panel
    // updates immediately; SSE snapshot may follow.
    updateActiveElementsBaseData(predicate, newBaseData);
    postTableOp({ op: 'update-base-data', elementId: matching.id, newBaseData }, tableId);
  };

  const sendSetMapConfig = (newConfig, resetTokenPositions = false) => {
    const { mapId: patchMapId, ...fields } = newConfig || {};
    const mid =
      patchMapId
      ?? mapViews.find(v => v.id === gmActiveViewId)?.mapId
      ?? activeMapId
      ?? maps[0]?.id
      ?? DEFAULT_LEGACY_MAP_ID;
    const source = maps.find((m) => m.id === mid);
    const merged = { ...(source || mapConfig), ...fields };
    postTableOp({ op: 'set-map', ...merged, resetTokenPositions, mapId: mid }, tableId);
  };

  const sendMapViewSync = useCallback(
    (mapViewZoomRatio, mapViewPanNorm, mapViewVisibleNorm) => {
      const mapId =
        mapViews.find(v => v.id === gmActiveViewId)?.mapId ??
        activeMapId ??
        maps[0]?.id ??
        DEFAULT_LEGACY_MAP_ID;
      if (gmActiveViewId == null) {
        postTableOp(
          { op: 'set-map-view', mapViewZoomRatio, mapViewPanNorm, mapViewVisibleNorm, viewId: null, mapId },
          tableId,
        );
        return;
      }
      postTableOp(
        { op: 'set-map-view', mapViewZoomRatio, mapViewPanNorm, mapViewVisibleNorm, viewId: gmActiveViewId },
        tableId,
      );
    },
    [tableId, gmActiveViewId, activeMapId, maps, mapViews],
  );

  const sendMapFreeExplore = useCallback(
    (mapId) => {
      postTableOp({ op: 'set-map-free-explore', mapId }, tableId);
    },
    [tableId],
  );

  const sendSetActiveView = useCallback(
    (viewId) => {
      postTableOp({ op: 'set-active-view', viewId }, tableId);
    },
    [tableId],
  );

  const sendForcePlayersToMapView = useCallback(
    (payload) => {
      postTableOp({ op: 'force-player-map-view', ...payload }, tableId);
    },
    [tableId],
  );

  const sendSetActiveMap = useCallback((id) => {
    postTableOp({ op: 'set-active-map', activeMapId: id }, tableId);
  }, [tableId]);

  const sendAddMapView = useCallback((payload = {}) => {
    postTableOp({ op: 'add-map-view', ...payload }, tableId);
  }, [tableId]);

  const sendRemoveMapView = useCallback(
    (viewId) => {
      postTableOp({ op: 'remove-map-view', viewId }, tableId);
    },
    [tableId],
  );

  const sendRenameMapView = useCallback(
    (viewId, name) => {
      postTableOp({ op: 'rename-map-view', viewId, name }, tableId);
    },
    [tableId],
  );

  const sendSetViewBroadcast = useCallback(
    (viewId, broadcastToPlayers) => {
      postTableOp({ op: 'set-view-broadcast', viewId, broadcastToPlayers }, tableId);
    },
    [tableId],
  );

  const sendSetViewLocked = useCallback(
    (viewId, locked) => {
      postTableOp({ op: 'set-view-locked', viewId, locked }, tableId);
    },
    [tableId],
  );

  const sendSetMapShare = useCallback(
    (mapId, shareWithPlayers) => {
      postTableOp({ op: 'set-map-share', mapId, shareWithPlayers }, tableId);
    },
    [tableId],
  );

  const sendSetMapOverlay = useCallback(
    (mapId, overlayPng) => {
      postTableOp({ op: 'set-map-overlay', mapId, overlayPng: overlayPng ?? null }, tableId);
    },
    [tableId],
  );

  const sendSetMapViewOverlay = useCallback(
    (viewId, overlayPng) => {
      postTableOp({ op: 'set-map-view-overlay', viewId, overlayPng: overlayPng ?? null }, tableId);
    },
    [tableId],
  );

  const sendAddMap = useCallback(() => {
    postTableOp({ op: 'add-map' }, tableId);
  }, [tableId]);

  /**
   * New map with image (paste / drop / upload / unified import when current map already has art).
   * `img.mapImageUrl` may be an inline `data:` URL (e.g. a client-side canvas crop) — upload it to
   * Storage first so the table_state row never carries a base64 blob (Fix 1, game table latency plan).
   */
  const sendAddMapWithImage = useCallback(async (img) => {
    let mapImageUrl = img.mapImageUrl;
    if (typeof mapImageUrl === 'string' && mapImageUrl.startsWith('data:')) {
      const file = await dataUrlToFile(mapImageUrl, 'map-image');
      const uploaded = await postMapImageFile(file);
      if (!uploaded?.url) throw new Error('Map image upload did not return a URL');
      mapImageUrl = uploaded.url;
    }
    const stub = {
      ...buildEmptyLibraryMap(generateId()),
      mapImageUrl,
      imageUrl: mapImageUrl,
      mapImageNaturalWidth: img.mapImageNaturalWidth ?? null,
      mapImageNaturalHeight: img.mapImageNaturalHeight ?? null,
    };
    await apiSaveItem('maps', stub);
    await postTableOp(buildAddMapOpFromLibraryItem(stub, {
      extraCameraVisibleNorms: img.extraCameraVisibleNorms,
    }), tableId);
    if (tableId) navigate(`/table/${tableId}/maps/${stub.id}`);
  }, [tableId, navigate]);

  /**
   * Replace the current map's image in place (`set-map`).
   * Mirrors sendAddMapWithImage's upload-then-op pattern.
   */
  const sendReplaceMapWithImage = useCallback(async (file, { fork = true, libraryMapId = null } = {}) => {
    const uploaded = await postMapImageFile(file);
    if (!uploaded?.url) throw new Error('Map image upload did not return a URL');
    const { width, height } = await loadImageNaturalSizeFromUrl(uploaded.url);
    sendSetMapConfig({
      mapImageUrl: uploaded.url,
      mapImageNaturalWidth: width,
      mapImageNaturalHeight: height,
      mapAiImagePrompt: null,
      librarySyncImage: fork ? false : true,
    });
    if (!fork && libraryMapId) {
      try {
        await apiSaveItem('maps', {
          id: libraryMapId,
          mapImageUrl: uploaded.url,
          imageUrl: uploaded.url,
          mapImageNaturalWidth: width,
          mapImageNaturalHeight: height,
          mapAiImagePrompt: null,
        });
      } catch (err) {
        console.warn('Library map image save failed', err);
      }
    }
  }, [sendSetMapConfig]);

  /** Upload a file and add it as a `mapImage` element on the current active map. */
  const sendAddMapImageObject = useCallback(async (file, opts = {}) => {
    let uploaded;
    if (effectiveIsPlayer) {
      uploaded = await postMapImageFileForTable(tableId, file);
    } else {
      uploaded = await postMapImageFile(file);
    }
    if (!uploaded?.url) throw new Error('Map image upload did not return a URL');
    const { width, height } = await loadImageNaturalSizeFromUrl(uploaded.url);
    const defaultWidthFt = 20;
    // Fall back to the last known viewport context (kept current by BattleMap's onViewportCenterChange)
    // so paste/drop placement lands in the visible area on the correct map/view.
    const centerX = opts.centerXFt ?? mapViewportCenterRef.current?.xFt ?? null;
    const centerY = opts.centerYFt ?? mapViewportCenterRef.current?.yFt ?? null;
    const el = {
      instanceId: generateId(),
      elementType: 'mapImage',
      mapId: opts.mapId ?? mapViewportCenterRef.current?.mapId ?? null,
      viewId: opts.viewId ?? mapViewportCenterRef.current?.viewId ?? null,
      createdByUid: user?.uid ?? null,
      imageUrl: uploaded.url,
      imageNaturalWidth: width,
      imageNaturalHeight: height,
      tokenX: centerX,
      tokenY: centerY,
      widthFt: defaultWidthFt,
      heightFt: defaultWidthFt * (height / width),
    };
    if (effectiveIsPlayer) {
      await postMapImageObject(tableId, { action: 'add', ...el });
    } else {
      postTableOp({ op: 'add-elements', elements: [el] }, tableId);
    }
  }, [tableId, effectiveIsPlayer, user?.uid]);

  /** Add a `drawShape` (rect/oval/brush) vector element on the current map — GM only, no upload. */
  const sendAddMapDrawShape = useCallback((shape) => {
    const el = { ...shape, createdByUid: user?.uid ?? null };
    postTableOp({ op: 'add-elements', elements: [el] }, tableId);
  }, [tableId, user?.uid]);

  const sendUpdateMapImageObject = useCallback((instanceId, updates) => {
    setActiveElements(prev => prev.map(el => el.instanceId === instanceId ? { ...el, ...updates } : el));
    if (effectiveIsPlayer) {
      postMapImageObject(tableId, { action: 'update', instanceId, updates }).catch(console.error);
    } else {
      postTableOp({ op: 'update-element', instanceId, updates }, tableId);
    }
  }, [tableId, effectiveIsPlayer]);

  const sendRemoveMapImageObject = useCallback((instanceId) => {
    if (effectiveIsPlayer) {
      postMapImageObject(tableId, { action: 'remove', instanceId }).catch(console.error);
    } else {
      postTableOp({ op: 'remove-element', instanceId }, tableId);
    }
  }, [tableId, effectiveIsPlayer]);

  const sendRemoveMap = useCallback((mapId) => {
    postTableOp({ op: 'remove-map', mapId }, tableId);
  }, [tableId]);

  const sendRenameMap = useCallback((mapId, name, extras = {}) => {
    postTableOp({ op: 'rename-map', mapId, name, ...extras }, tableId);
  }, [tableId]);

  const sendLifeSupportSelect = (rollDbId, instanceId) => {
    const key = String(rollDbId);
    const current = lifeSupportSelections[key];
    const isDeselect = current === instanceId;
    setLifeSupportSelections(prev => {
      const next = { ...prev };
      if (isDeselect) delete next[key];
      else next[key] = instanceId;
      return next;
    });
    postLifeSupportSelect(tableId, rollDbId, isDeselect ? null : instanceId);
  };

  const sendLifeSupportClear = (rollDbId) => {
    setLifeSupportSelections(prev => {
      const next = { ...prev };
      delete next[String(rollDbId)];
      return next;
    });
    postTableOp({ op: 'life-support-clear', _rollDbId: rollDbId }, tableId);
  };

  const gmUidForRest = (route.view === 'table' ? tableOwnerUid : null) ?? user?.uid;
  const sendRestMoveSelect = (rollDbId, instanceId, slot, moveId, options = {}) => {
    if (gmUidForRest) postRestMoveSelect(tableId, rollDbId, instanceId, slot, moveId, options);
  };
  const sendRestMoveClear = (rollDbId) => {
    postTableOp({ op: 'rest-move-clear', _rollDbId: rollDbId }, tableId);
  };

  // Player callback — sends update to server; state arrives via table_state SSE snapshot.
  // Token positions, conditions, and resource tracks are applied optimistically like the GM path.
  const handlePlayerCharacterUpdate = useCallback(async (instanceId, updates) => {
    if (!route.tableId) return;
    const el = activeElements.find((e) => e.instanceId === instanceId);
    if (!sessionPlayAllowed && isPrepModeElementUpdateBlocked(updates, el?.elementType)) {
      return;
    }
    if (shouldOptimisticallyPatch(updates)) {
      setActiveElements(prev => prev.map(el => el.instanceId === instanceId ? { ...el, ...updates } : el));
    }
    try {
      await postCharacterUpdate(route.tableId, instanceId, updates);
    } catch (err) {
      if (err?.playBlocked === 'paused' || err?.playBlocked === 'prep') return;
      console.error('postCharacterUpdate failed:', err);
    }
  }, [route.tableId, sessionPlayAllowed, activeElements]);

  const handlePlayerAddCharacter = useCallback(async (charData) => {
    if (!route.tableId) return undefined;
    try {
      const res = await postAddCharacter(route.tableId, charData);
      // State update is handled by the character-added SSE event that the server broadcasts
      // to all room clients (including this player). Updating here too would double-add.
      return res;
    } catch (err) {
      console.error('postAddCharacter failed:', err);
      return undefined;
    }
  }, [route.tableId]);

  // GM impersonation: add a character on behalf of the previewed player.
  const handleGmImpersonateAddCharacter = async (charData) => {
    const { name, playerName, tier, maxHope, maxHp, maxStress, hope, ...rest } = charData;
    const maxH = maxHope ?? 6;
    const newEls = await sendAddToTable({
      ...rest,
      elementType: 'character',
      name: name ?? '',
      playerName,
      tier: tier ?? 1,
      hope: hope ?? Math.min(DEFAULT_CHARACTER_STARTING_HOPE, maxH),
      maxHope: maxH,
      maxHp: maxHp ?? 6,
      maxStress: maxStress ?? 6,
      currentHp: maxHp ?? 6,
      currentStress: 0,
      conditions: '',
      assignedPlayerEmail: previewAsPlayerEmail || undefined,
    }, 'characters');
    return { character: newEls?.[0] };
  };


  const getGlobalLibraryAssistantContext = useCallback(() => ({
    scope: {
      collection: 'all',
      includeMine: true,
      includePublic: true,
      includeSrd: true,
    },
    browseState: route.view === 'library'
      ? {
          activeTab: route.tab || DEFAULT_LIBRARY_TAB,
          search: route.librarySearchQuery || '',
          semantic: route.librarySemantic || '',
        }
      : {
          activeTab: 'all',
          search: '',
          semantic: '',
        },
  }), [route]);

  const openLibraryAssistantReference = useCallback((item) => {
    const collection = item?._collection || 'all';
    setLibraryAssistantOpen(false);
    navigate(buildLibraryModalPath('all', collection, item.id));
  }, [navigate]);

  return (
    <AiUiPreferenceProvider hideAiUi={hideAiUi} setHideAiUi={setHideAiUi}>
    <UnifiedImportProvider
      enabled={!!user && !effectiveIsPlayer}
      saveItem={saveItem}
      addToTable={sendAddToTable}
      onAddMapWithImage={route.view === 'table' && !effectiveIsPlayer ? sendAddMapWithImage : undefined}
      onReplaceMapWithImage={route.view === 'table' && !effectiveIsPlayer ? async (file) => {
        const active = maps.find((m) => m.id === (activeMapId || maps[0]?.id));
        if (active?.libraryMapId) {
          setMapReplaceChoice({ file, libraryMapId: active.libraryMapId, name: active.name });
          return;
        }
        await sendReplaceMapWithImage(file, { fork: true });
      } : undefined}
      onAddMapImageObject={route.view === 'table' ? sendAddMapImageObject : undefined}
      effectiveIsPlayer={effectiveIsPlayer}
      navigate={navigate}
      tableId={tableId}
      isGameTableGm={route.view === 'table' && !effectiveIsPlayer}
      importLibraryData={{ adversaries: data.adversaries, environments: data.environments }}
      onImportComplete={() => setLibraryKey((k) => k + 1)}
      libraryBrowseData={data}
      partySize={partySize}
      partyTier={partyTier}
      mapViewportAspect={battleMapViewportAspect}
    >
    <div className="h-[100dvh] bg-dh-surface text-dh font-sans flex flex-col overflow-hidden">
      {mapReplaceChoice && (
        <EditChoiceDialog
          itemName={mapReplaceChoice.name || 'Map'}
          contextLabel="Table"
          canEditOriginal
          onEditCopy={() => {
            const { file } = mapReplaceChoice;
            setMapReplaceChoice(null);
            void sendReplaceMapWithImage(file, { fork: true });
          }}
          onEditOriginal={() => {
            const { file, libraryMapId } = mapReplaceChoice;
            setMapReplaceChoice(null);
            void sendReplaceMapWithImage(file, { fork: false, libraryMapId });
          }}
          onClose={() => setMapReplaceChoice(null)}
        />
      )}
      {typeof document !== 'undefined' && route.view === 'table' && user && sessionPaused && createPortal(
        <SessionBlockedBanner
          isPlayer={effectiveIsPlayer}
          onResume={!effectiveIsPlayer ? handleSessionBannerResume : undefined}
        />,
        document.body
      )}
      {typeof document !== 'undefined' && route.view === 'table' && user && tableStateReady && showChooseSpotlightBanner(sessionPlayAllowed, spotlight) && createPortal(
        <ChooseSpotlightBanner />,
        document.body
      )}
      <nav className="bg-dh-canvas border-b border-dh-border p-4 flex items-center justify-between shadow-md z-[70]">
          <div className="flex items-center gap-6">
            <a
              href="/"
              onClick={(e) => { if (shouldHandleSpaNavClick(e)) { e.preventDefault(); navigate('/'); } }}
              className="text-xl font-bold text-red-500 tracking-wider flex items-center gap-2 no-underline"
            >
              <img src="/assets/daggertop-logo.png" alt="Daggertop" className="w-8 h-8 object-contain" /> DAGGERTOP
            </a>
            <div className="flex items-center gap-2">
              <NavImportBtn />
              <NavBtn icon={<BookOpen />} label="Library" active={route.view === 'library'} href={lastLibraryPathRef.current} onClick={() => navigate(lastLibraryPathRef.current)} />
              <NavAssistantBtn active={libraryAssistantOpen} onClick={() => setLibraryAssistantOpen(true)} />
              {user && (<>
              {navRecentTables.map((t) => (
                <NavBtn
                  key={t.tableId}
                  icon={<LayoutDashboard />}
                  label={t.label}
                  active={route.view === 'table' && route.tableId === t.tableId}
                  href={`/table/${t.tableId}`}
                  onClick={() => navigate(`/table/${t.tableId}`)}
                />
              ))}
              {showNavMoreTables && (
                <NavBtn
                  icon={<Ellipsis />}
                  label="More"
                  active={false}
                  href="/"
                  onClick={() => navigate('/')}
                />
              )}
              {!isPlayer && (
                <NavBtn
                  icon={<Plus size={16} />}
                  label="New Table"
                  active={false}
                  onClick={handleCreateTable}
                />
              )}
              </>)}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-dh-muted">
            {(importStatus || onboardingFlash) && (
              <span className="text-xs text-green-400 font-medium">{importStatus || onboardingFlash}</span>
            )}
            {user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-dh-raised transition-colors"
              >
                <div className="flex flex-col items-end">
                  <span className="text-green-500 font-medium">{user.displayName || user.email || 'Signed In'}</span>
                  <span className="text-[10px] opacity-60 font-mono">{user.email}</span>
                  {primaryTableBillingStatus && (() => {
                    const bs = primaryTableBillingStatus;
                    if (bs.isLive && bs.reason === 'campaign_pass' && bs.paidThroughAt) {
                      const d = new Date(bs.paidThroughAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                      return <span className="text-[9px] opacity-50 font-mono text-emerald-400">Covered through {d}</span>;
                    }
                    if (bs.isLive && bs.reason === 'free_trial' && bs.trialEndsAt) {
                      const diff = new Date(bs.trialEndsAt) - Date.now();
                      const days = Math.max(0, Math.floor(diff / 86400000));
                      const urgent = days <= 7;
                      return <span className={`text-[9px] font-mono ${urgent ? 'text-amber-400 opacity-80' : 'opacity-50 text-dh-muted'}`}>Trial: {days === 0 ? 'ends today' : `${days}d left`}</span>;
                    }
                    if (!bs.isLive) {
                      const label = billingNavIndicatorCopy(bs.reason);
                      const muted = bs.reason === 'never_started';
                      return (
                        <span className={`text-[9px] font-mono ${muted ? 'opacity-40 text-dh-muted' : 'text-red-400 opacity-80'}`}>
                          {label}
                        </span>
                      );
                    }
                    return <span className="text-[9px] opacity-40 font-mono">Free plan</span>;
                  })()}
                </div>
                <ChevronDown size={14} className={`text-dh-muted transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-dh-raised border border-dh-strong rounded-lg shadow-xl z-50 py-1">
                  <UserMenuAiTurnOn onPicked={() => setUserMenuOpen(false)} />
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setFeatureAuthoringGuideOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-dh hover:bg-dh-hover hover:text-dh transition-colors"
                  >
                    <ScrollText size={15} /> Feature authoring guide
                  </button>
                  <button
                    type="button"
                    onClick={handleEnableOnboarding}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-dh hover:bg-dh-hover hover:text-dh transition-colors"
                  >
                    <Sparkles size={15} /> Enable onboarding
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate('/admin/ai-usage');
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm bg-red-900/80 hover:bg-red-800 text-red-200 border-t border-red-700 transition-colors"
                    >
                      <ShieldOff size={15} /> AI usage metrics
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate('/admin/bug-reports');
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm bg-red-900/80 hover:bg-red-800 text-red-200 border-y border-red-700 transition-colors"
                    >
                      <Bug size={15} /> Problem reports
                    </button>
                  )}
                  <button
                    onClick={handleExport}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-dh hover:bg-dh-hover hover:text-dh transition-colors"
                  >
                    <Download size={15} /> Export JSON
                  </button>
                  <label className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-dh hover:bg-dh-hover hover:text-dh transition-colors cursor-pointer">
                    <Upload size={15} /> Import JSON
                    <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                  </label>
                  <div className="border-t border-dh-strong my-1" />
                  <button
                    onClick={handleDeleteAllData}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-orange-400 hover:bg-dh-hover hover:text-orange-300 transition-colors"
                  >
                    <Trash2 size={15} /> Delete All Data
                  </button>
                  <div className="border-t border-dh-strong my-1" />
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-dh-hover hover:text-red-300 transition-colors"
                  >
                    <LogOut size={15} /> Sign Out
                  </button>
                </div>
              )}
            </div>
            ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => requireAuthRedirect('signin')}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-dh-muted hover:text-dh hover:bg-dh-raised/50 transition-all duration-300"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => requireAuthRedirect('signup')}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-all duration-300"
              >
                Sign Up
              </button>
            </div>
            )}
          </div>
        </nav>

      <main className="flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-dh">Loading...</div>
        ) : (
          <>
        {route.view === 'home' && (user ? (
          <HomeAuthenticated
            myTables={myTables}
            myRooms={myRooms}
            publicTables={publicTables}
            publicLobbyGeneration={publicLobbyGeneration}
            onCreateTable={handleCreateTable}
            navigate={navigate}
            data={data}
            saveItem={saveItem}
            saveImage={saveImage}
            deleteItem={deleteItem}
            cloneItem={cloneItem}
            addToTable={sendAddToTable}
            route={route}
            isAdmin={isAdmin}
            partySize={partySize}
            partyTier={partyTier}
            characters={characters}
            userUid={user?.uid}
            onItemsChange={syncDataToApp}
            onMergeAdversary={mergeAdversaryIntoData}
            ensureAdventuresLoaded={ensureAdventuresLoaded}
            ensureCharactersLoaded={ensureCharactersLoaded}
            libraryKey={libraryKey}
            onRequireAuth={() => requireAuthRedirect('signin')}
            libraryCardDimensions={libraryCardDimensions}
            onLibraryCardDimensionsChange={handleLibraryCardDimensionsChange}
          />
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center px-8 py-10 bg-gradient-to-b from-dh-surface to-dh-canvas">
            <img src="/assets/daggertop-logo.png" alt="Daggertop" className="w-40 h-40 object-contain mb-4" />
            <h1 className="text-5xl font-bold text-red-500 tracking-wider mb-3 flex items-center gap-3">DAGGERTOP</h1>
            <p className="text-lg text-dh-muted mb-4 text-center max-w-lg">The best way to play the Daggerheart RPG.</p>
            <ul className="text-dh-muted text-sm text-left max-w-lg mb-8 space-y-2 list-none">
            <li className="flex gap-2"><span className="text-red-500 mt-0.5 shrink-0">•</span><span>Virtual tabletop (VTT) built specifically for Daggerheart, with Hope, Fear, and range tracking, multiple maps and cameras, a dice roller and action log, and more!</span></li>
            <li className="flex gap-2"><span className="text-red-500 mt-0.5 shrink-0">•</span><span>Full mechanical support for every class, subclass, ancestry, and community in the SRD.</span></li>
            <li className="flex gap-2"><span className="text-red-500 mt-0.5 shrink-0">•</span><span>Character builder with full support through level 10 and easy renaming of features for flavor.</span></li>
              <li className="flex gap-2"><span className="text-red-500 mt-0.5 shrink-0">•</span><span>Library of adversaries, environments, and more — pick up and play or dive deep into homebrew built by you and other creators.</span></li>
            </ul>
            <AuthLanding initialMode={route.authMode || 'signin'} />
            <HomeFeatureShots navigate={navigate} />
            <Footer navigate={navigate} />
          </div>
        ))}
            <div
              className="flex-1 overflow-hidden flex flex-col"
              style={{ display: route.view === 'terms' ? 'flex' : 'none' }}
              aria-hidden={route.view !== 'terms'}
            >
              {route.view === 'terms' && <TermsPage navigate={navigate} />}
            </div>
            <div
              className="flex-1 overflow-hidden flex flex-col"
              style={{ display: route.view === 'privacy' ? 'flex' : 'none' }}
              aria-hidden={route.view !== 'privacy'}
            >
              {route.view === 'privacy' && <PrivacyPage navigate={navigate} />}
            </div>
            <div
              className="flex-1 overflow-hidden flex flex-col"
              style={{ display: route.view === 'support' ? 'flex' : 'none' }}
              aria-hidden={route.view !== 'support'}
            >
              {route.view === 'support' && <SupportPage navigate={navigate} />}
            </div>
            <div
              className="flex-1 overflow-hidden flex flex-col"
              style={{ display: route.view === 'cookies' ? 'flex' : 'none' }}
              aria-hidden={route.view !== 'cookies'}
            >
              {route.view === 'cookies' && <CookiesPage navigate={navigate} />}
            </div>
            {user && (
            <>
            <div
              className="flex-1 overflow-hidden flex flex-col"
              style={{ display: route.view === 'adminAiUsage' ? 'flex' : 'none' }}
              aria-hidden={route.view !== 'adminAiUsage'}
            >
              {route.view === 'adminAiUsage' && isAdmin && <AdminAiUsagePage navigate={navigate} />}
            </div>
            <div
              className="flex-1 overflow-hidden flex flex-col"
              style={{ display: route.view === 'adminBugReports' ? 'flex' : 'none' }}
              aria-hidden={route.view !== 'adminBugReports'}
            >
              {route.view === 'adminBugReports' && isAdmin && <AdminBugReportsPage navigate={navigate} />}
            </div>
            </>
            )}
            <div
              className="flex-1 overflow-hidden flex flex-col"
              style={{ display: route.view === 'library' ? 'flex' : 'none' }}
              aria-hidden={route.view !== 'library'}
            >
              <LibraryView
                key={libraryKey}
                isAuthenticated={!!user}
                onRequireAuth={() => requireAuthRedirect('signin')}
                userUid={user?.uid}
                data={data}
                saveItem={saveItem}
                saveImage={saveImage}
                deleteItem={deleteItem}
                cloneItem={cloneItem}
                addToTable={sendAddToTable}
                route={
                  route.view === 'library'
                    ? route
                    : {
                        view: 'library',
                        tab: (lastLibraryPathRef.current.match(/^\/library\/([^/]+)/)?.[1]) || DEFAULT_LIBRARY_TAB,
                        itemId: null,
                        librarySemantic: null,
                        librarySearchQuery: null,
                      }
                }
                navigate={navigate}
                onItemsChange={syncDataToApp}
                onMergeAdversary={mergeAdversaryIntoData}
                isAdmin={isAdmin}
                partySize={partySize}
                partyTier={partyTier}
                characters={characters}
                ensureAdventuresLoaded={ensureAdventuresLoaded}
                ensureCharactersLoaded={ensureCharactersLoaded}
                myTables={myTables}
                libraryCardDimensions={user ? libraryCardDimensions : null}
                onLibraryCardDimensionsChange={user ? handleLibraryCardDimensionsChange : undefined}
              />
            </div>
            <div
              className="flex-1 overflow-hidden flex flex-col"
              style={{ display: route.view === 'table' ? 'flex' : 'none' }}
              aria-hidden={route.view !== 'table'}
            >
              {tableAccessError === 'not-found' && route.view === 'table' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-dh-muted">
                  <span className="text-5xl">🗺️</span>
                  <p className="text-lg font-semibold text-dh">Table not found</p>
                  <p className="text-sm">This table doesn't exist or you haven't been invited.</p>
                </div>
              )}
              {tableAccessError === 'private' && user && route.view === 'table' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-dh-muted">
                  <span className="text-5xl">🗺️</span>
                  <p className="text-lg font-semibold text-dh">Private table</p>
                  <p className="text-sm">You need an invite link to join this table.</p>
                </div>
              )}
              {!tableAccessError && <GMTableView
                tableId={tableId}
                activeElements={activeElements}
                updateActiveElement={isSpectator ? () => {} : (isPlayer ? handlePlayerCharacterUpdate : sendUpdateActiveElement)}
                removeActiveElement={effectiveIsPlayer ? () => {} : sendRemoveActiveElement}
                updateActiveElementsBaseData={effectiveIsPlayer ? () => {} : sendUpdateActiveElementsBaseData}
                data={data}
                saveItem={isSpectator ? undefined : (effectiveIsPlayer
                  ? (col, item) => col === 'characters' ? saveItem(col, { ...item, _tableId: tableId }) : undefined
                  : (col, item) => col === 'characters' ? saveItem(col, { ...item, _tableId: tableId }) : saveItem(col, item)
                )}
                saveImage={isSpectator ? undefined : (effectiveIsPlayer
                  ? (col, id, url, opts) => col === 'characters' ? saveImage(col, id, url, { ...opts, tableId }) : undefined
                  : (col, id, url, opts) => col === 'characters' ? saveImage(col, id, url, { ...opts, tableId }) : saveImage(col, id, url, opts)
                )}
                addToTable={effectiveIsPlayer ? () => {} : sendAddToTable}
                addElements={effectiveIsPlayer ? undefined : sendAddElements}
                sendDoAddToTable={effectiveIsPlayer ? undefined : sendDoAddToTable}
                onMergeAdversary={mergeAdversaryIntoData}
                user={user}
                ensureAdventuresLoaded={ensureAdventuresLoaded}
                ensureCharactersLoaded={ensureCharactersLoaded}
                route={route}
                navigate={navigate}
                featureCountdowns={featureCountdowns}
                sessionCountdowns={sessionCountdowns}
                updateCountdown={effectiveIsPlayer ? () => {} : sendUpdateCountdown}
                partySize={partySize}
                partyTier={partyTier}
                characters={characters}
                tableBattleMods={tableBattleMods}
                nextScenes={nextScenes}
                libraryCardDimensions={user ? libraryCardDimensions : null}
                setTableBattleMods={effectiveIsPlayer ? () => {} : sendSetTableBattleMods}
                fearCount={fearCount}
                setFearCount={effectiveIsPlayer ? () => {} : sendSetFearCount}
                partyLoot={partyLoot}
                onSetPartyLoot={effectiveIsPlayer ? undefined : sendSetPartyLoot}
                onMoveInventoryItem={effectiveIsPlayer ? undefined : sendMoveInventoryItem}
                spotlight={spotlight}
                onSpotlightChange={effectiveIsPlayer ? undefined : sendSetSpotlight}
                conditionsHistory={conditionsHistory}
                onAddConditionsHistoryEntry={effectiveIsPlayer ? undefined : sendAddConditionsHistoryEntry}
                onRemoveConditionsHistoryEntry={effectiveIsPlayer ? undefined : sendRemoveConditionsHistoryEntry}
                tableName={tableName}
                gmDisplayName={tableGmDisplayName || (user?.displayName || user?.email || '')}
                tableStateReady={tableStateReady}
                isSpectator={isSpectator}
                isPublic={tableIsPublic}
                onPublicChange={!effectiveIsPlayer ? sendSetTablePublic : undefined}
                audienceOnlineCount={audienceOnlineCount}
                onTableNameChange={!effectiveIsPlayer ? sendSetTableName : undefined}
                onDeleteTable={tableId && !effectiveIsPlayer ? () => {
                  const name = (tableName?.trim() || 'Game Table');
                  setDeleteTablePending({ id: tableId, name });
                  setDeleteConfirmInput('');
                } : undefined}
                clearTable={effectiveIsPlayer ? () => {} : sendClearTable}
                isPlayer={effectiveIsPlayer}
                playerEmail={effectivePlayerEmail}
                connectedPlayers={connectedPlayers}
                playerEmails={playerEmails}
                playerNames={playerNames}
                inviteLink={inviteLink}
                onGenerateInviteLink={effectiveIsPlayer ? undefined : sendGenerateInviteLink}
                onRevokeInviteLink={effectiveIsPlayer ? undefined : sendRevokeInviteLink}
                onRemovePlayerEmail={effectiveIsPlayer ? undefined : sendRemovePlayerEmail}
                onLeaveTable={isPlayer && !isSpectator ? sendLeaveTable : undefined}
                gmUid={tableOwnerUid ?? user?.uid}
                onPlayerAddCharacter={isSpectator ? undefined : (isPlayer ? handlePlayerAddCharacter : (isPreviewMode ? handleGmImpersonateAddCharacter : undefined))}
                pendingBanners={pendingBanners}
                pendingPlayerIntent={pendingPlayerIntent}
                intentDifficultyUpdate={intentDifficultyUpdate}
                spotlightRequestGrant={spotlightRequestGrant}
                onSpotlightRequestGrantConsumed={consumeSpotlightRequestGrant}
                onFeatureRequestSuccess={effectiveIsPlayer ? (bannerId, stateKey) => {
                  if (stateKey == null) return;
                  setFeatureRequestedBannerIdsByKey(prev => ({
                    ...prev,
                    [stateKey]: new Set([...(prev[stateKey] || []), bannerId]),
                  }));
                } : undefined}
                onFeatureRequestCancel={effectiveIsPlayer ? (bannerId, stateKey) => {
                  if (stateKey == null) return;
                  setFeatureRequestedBannerIdsByKey(prev => {
                    const set = prev[stateKey];
                    if (!set) return prev;
                    const next = new Set(set);
                    next.delete(bannerId);
                    return { ...prev, [stateKey]: next };
                  });
                } : undefined}
                rangerFocusRequestedBannerIds={rangerFocusRequestedBannerIds}
                onRangerFocusRerollRequestSuccess={effectiveIsPlayer ? (bannerId) => setRangerFocusRequestedBannerIds(prev => new Set([...prev, bannerId])) : undefined}
                onRangerFocusRerollRequestCancel={effectiveIsPlayer ? (bannerId) => setRangerFocusRequestedBannerIds(prev => { const next = new Set(prev); next.delete(bannerId); return next; }) : undefined}
                previewAsPlayerEmail={isPreviewMode ? previewAsPlayerEmail : null}
                onPreviewAsPlayer={!effectiveIsPlayer ? setPreviewAsPlayerEmail : undefined}
                onExitPreview={isPreviewMode ? () => setPreviewAsPlayerEmail(null) : undefined}
                actionLog={actionLog}
                setActionLog={setActionLog}
                mapConfig={battleMapConfig}
                maps={maps}
                activeMapId={activeMapId ?? maps[0]?.id ?? null}
                gmMapView={gmMapView}
                mapViews={mapViews}
                gmActiveViewId={gmActiveViewId}
                onSetActiveView={effectiveIsPlayer ? undefined : sendSetActiveView}
                onAddMapViewOp={effectiveIsPlayer ? undefined : sendAddMapView}
                onRemoveMapView={effectiveIsPlayer ? undefined : sendRemoveMapView}
                onRenameMapView={effectiveIsPlayer ? undefined : sendRenameMapView}
                onSetViewBroadcast={effectiveIsPlayer ? undefined : sendSetViewBroadcast}
                onSetViewLocked={effectiveIsPlayer ? undefined : sendSetViewLocked}
                onSetMapShare={effectiveIsPlayer ? undefined : sendSetMapShare}
                playerSelectedViewId={effectiveIsPlayer ? playerSelectedViewId : null}
                onPlayerSelectView={effectiveIsPlayer ? handlePlayerSelectMapView : undefined}
                playerFreeMapExplore={effectiveIsPlayer ? playerFreeMapExplore : false}
                playerFreeExploreMapId={effectiveIsPlayer ? playerFreeExploreMapId : null}
                onPlayerEnterMapFreeExplore={effectiveIsPlayer ? handlePlayerEnterMapFreeExplore : undefined}
                onPlayerExitMapFreeExplore={effectiveIsPlayer ? handlePlayerExitMapFreeExplore : undefined}
                onMapFreeExplore={!effectiveIsPlayer ? sendMapFreeExplore : undefined}
                onForcePlayersToMapView={!effectiveIsPlayer ? sendForcePlayersToMapView : undefined}
                onSetActiveMap={effectiveIsPlayer ? undefined : sendSetActiveMap}
                onAddMap={effectiveIsPlayer ? undefined : sendAddMap}
                onAddMapWithImage={effectiveIsPlayer ? undefined : sendAddMapWithImage}
                onReplaceMapWithImage={effectiveIsPlayer ? undefined : sendReplaceMapWithImage}
                onAddMapImageObject={isSpectator ? undefined : sendAddMapImageObject}
                onAddMapDrawShape={effectiveIsPlayer ? undefined : sendAddMapDrawShape}
                onUpdateMapImageObject={isSpectator ? undefined : sendUpdateMapImageObject}
                onRemoveMapImageObject={isSpectator ? undefined : sendRemoveMapImageObject}
                onRemoveMap={effectiveIsPlayer ? undefined : sendRemoveMap}
                onRenameMap={effectiveIsPlayer ? undefined : sendRenameMap}
                onMapConfigChange={effectiveIsPlayer ? () => {} : sendSetMapConfig}
                onMapViewSync={
                  shouldPersistMapViewToTable({ userUid: user?.uid, tableOwnerUid, effectiveIsPlayer })
                    ? sendMapViewSync
                    : undefined
                }
                lifeSupportSelections={lifeSupportSelections}
                onLifeSupportSelect={isSpectator ? () => {} : sendLifeSupportSelect}
                onLifeSupportClear={effectiveIsPlayer ? () => {} : sendLifeSupportClear}
                restMovesSelections={restMovesSelections}
                onRestMoveSelect={isSpectator ? () => {} : sendRestMoveSelect}
                onRestMoveClear={effectiveIsPlayer ? () => {} : sendRestMoveClear}
                tableFeatureState={tableFeatureState}
                sessionPlayAllowed={sessionPlayAllowed}
                sessionStarted={sessionStarted}
                sessionPaused={sessionPaused}
                mapPings={mapPings}
                onDismissMapPing={dismissMapPing}
                appendMapPing={appendMapPing}
                mapScribbles={mapScribbles}
                onSetMapOverlay={!effectiveIsPlayer ? sendSetMapOverlay : undefined}
                onSetMapViewOverlay={!effectiveIsPlayer ? sendSetMapViewOverlay : undefined}
                onBattleMapViewportAspectChange={setBattleMapViewportAspect}
                onBattleMapViewportCenterChange={(center) => { mapViewportCenterRef.current = center; }}
                isAdmin={isAdmin}
              />}
            </div>
            {user && route.view === 'join' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-dh-muted">
                {joinLinkError ? (
                  <>
                    <span className="text-5xl">🔗</span>
                    <p className="text-lg font-semibold text-dh">Invite link invalid</p>
                    <p className="text-sm">{joinLinkError}</p>
                  </>
                ) : (
                  <p className="text-dh">Joining table...</p>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <LibraryAssistantModalGated
        open={libraryAssistantOpen}
        onClose={() => setLibraryAssistantOpen(false)}
        data={data}
        navigate={navigate}
        partySize={partySize}
        partyTier={partyTier}
        characters={characters}
        getAssistantContext={getGlobalLibraryAssistantContext}
        onOpenItem={openLibraryAssistantReference}
      />
      {user && (
        <FeatureAuthoringGuideModal
          open={featureAuthoringGuideOpen}
          onClose={() => setFeatureAuthoringGuideOpen(false)}
        />
      )}
      {pendingSceneAdd && (
        <SceneAdoptDialog
          scene={{ ...pendingSceneAdd.scene, battleMods: pendingSceneAdd.scene.tableBattleMods || pendingSceneAdd.scene.battleMods }}
          scenes={[pendingSceneAdd.scene, ...(pendingSceneAdd.moreScenes || [])]}
          tableHref={pendingSceneAdd.targetTableId ? `/table/${encodeURIComponent(pendingSceneAdd.targetTableId)}` : undefined}
          currentTableMods={tableBattleMods}
          onConfirm={({ mode, applySceneBattleMods }) => {
            const batch = [pendingSceneAdd.scene, ...(pendingSceneAdd.moreScenes || [])];
            const factorIdx = batch.findIndex((s) => sceneHasActiveBattleMods(s));
            const applyAt = factorIdx >= 0 ? factorIdx : 0;
            setPendingSceneAdd(null);
            void (async () => {
              for (let i = 0; i < batch.length; i += 1) {
                await sendDoAddToTable(batch[i], 'scenes', pendingSceneAdd.targetTableId, {
                  replaceScene: mode === 'replace' && i === 0,
                  applySceneBattleMods: applySceneBattleMods && i === applyAt,
                });
              }
            })();
          }}
          onCancel={() => setPendingSceneAdd(null)}
        />
      )}
      {deleteTablePending && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70"
          onClick={() => { setDeleteTablePending(null); setDeleteConfirmInput(''); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-table-title"
        >
          <div
            className="bg-dh-raised border border-dh-strong rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-table-title" className="text-lg font-semibold text-red-400 mb-2">Delete table?</h2>
            <p className="text-dh text-sm mb-4">
              Permanently delete &ldquo;{deleteTablePending.name}&rdquo;? All encounter data, map, tokens, and settings will be lost. This cannot be undone.
            </p>
            <p className="text-dh-muted text-xs mb-2">Type <strong className="text-dh font-mono">DELETE</strong> to confirm:</p>
            <input
              type="text"
              value={deleteConfirmInput}
              onChange={(e) => setDeleteConfirmInput(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 rounded-md bg-dh-surface border border-dh-strong text-dh placeholder-dh-muted focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 mb-4 font-mono"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setDeleteTablePending(null); setDeleteConfirmInput(''); }
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                tabIndex={0}
                onClick={() => { setDeleteTablePending(null); setDeleteConfirmInput(''); }}
                className="px-4 py-2 rounded-md bg-dh-hover text-dh hover:opacity-90 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                tabIndex={0}
                disabled={deleteConfirmInput !== 'DELETE'}
                onClick={async () => {
                  const { id } = deleteTablePending;
                  setDeleteTablePending(null);
                  setDeleteConfirmInput('');
                  try {
                    await apiDeleteItem('table_state', id);
                    const next = myTables.filter(t => t.id !== id);
                    setMyTables(next);
                    if (route.tableId === id) {
                      if (next.length) navigate(`/table/${next[0].id}`);
                      else navigate('/');
                    }
                  } catch (err) {
                    console.error('Delete table failed:', err);
                  }
                }}
                className="px-4 py-2 rounded-md bg-red-800 text-red-100 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Permanently delete table
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
    </UnifiedImportProvider>
    </AiUiPreferenceProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <AppRoot>
    <App />
  </AppRoot>,
);
