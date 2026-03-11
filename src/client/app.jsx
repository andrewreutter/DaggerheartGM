import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { signInWithPopup, signOut, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';
import { Swords, BookOpen, LayoutDashboard, Users, ChevronDown, LogOut, Upload, Download, Trash2, Circle } from 'lucide-react';

import { auth, getAuthToken, CLIENT_ID, loadCollection, loadTableState, resolveItems, saveItem as apiSaveItem, saveImage as apiSaveImage, deleteItem as apiDeleteItem, cloneItemToLibrary, recordPlay, fetchMe, fetchMyRooms, postCharacterUpdate, postAddCharacter, postDiceAck, postTableOp } from './lib/api.js';
import { generateId } from './lib/helpers.js';
import { isOwnItem } from './lib/constants.js';
import { computeBattlePoints } from './lib/battle-points.js';
import { RUNTIME_KEYS, CHARACTER_RUNTIME_KEYS, applyPlayerTableOp } from './lib/table-ops.js';

const NON_PAGINATED_COLLECTIONS = ['scenes', 'adventures', 'characters'];

import { useRouter } from './lib/router.js';
import { NavBtn } from './components/NavBtn.jsx';
import { LibraryView } from './components/LibraryView.jsx';
import { GMTableView } from './components/GMTableView.jsx';
import { SceneAdoptDialog } from './components/SceneAdoptDialog.jsx';

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

  const [activeElements, setActiveElements] = useState([]);
  const [playerEmails, setPlayerEmails] = useState([]); // GM's invited player emails
  const [featureCountdowns, setFeatureCountdowns] = useState({});

  // Resolve character elements against the library so that library edits (leveling up, etc.)
  // propagate to the table automatically. Only CHARACTER_RUNTIME_KEYS are preserved from the
  // stored element; everything else comes from the live library record.
  // Non-character elements and characters not found in the library pass through unchanged.
  const resolvedActiveElements = useMemo(() => {
    const libraryById = new Map((data.characters || []).map(c => [c.id, c]));
    return activeElements.map(el => {
      if (el.elementType !== 'character' || !el.id) return el;
      const libraryChar = libraryById.get(el.id);
      if (!libraryChar) return el;
      const runtime = {};
      CHARACTER_RUNTIME_KEYS.forEach(k => { if (k in el) runtime[k] = el[k]; });
      return { ...libraryChar, ...runtime };
    });
  }, [activeElements, data.characters]);

  const partySize = useMemo(() => Math.max(1, resolvedActiveElements.filter(el => el.elementType === 'character').length), [resolvedActiveElements]);
  const partyTier = useMemo(() => {
    const chars = resolvedActiveElements.filter(el => el.elementType === 'character');
    return chars.length > 0 ? Math.max(...chars.map(c => c.tier ?? 1)) : 1;
  }, [resolvedActiveElements]);
  const characters = useMemo(
    () => resolvedActiveElements.filter(el => el.elementType === 'character').map(c => ({ name: c.name, tier: c.tier ?? 1 })),
    [resolvedActiveElements]
  );
  const DEFAULT_BATTLE_MODS = { lessDifficult: false, slightlyMoreDangerous: false, damageBoostPlusOne: false, damageBoostD4: false, damageBoostStatic: false, moreDangerous: false };
  const [tableBattleMods, setTableBattleMods] = useState(DEFAULT_BATTLE_MODS);
  const [fearCount, setFearCount] = useState(0);
  const DEFAULT_MAP_CONFIG = { mapImageUrl: null, mapDimension: 'width', mapSizeFt: 100, mapImageNaturalWidth: null, mapImageNaturalHeight: null };
  const [mapConfig, setMapConfig] = useState(DEFAULT_MAP_CONFIG);
  const [pendingSceneAdd, setPendingSceneAdd] = useState(null); // { scene }
  const tableStateReadyRef = useRef(false);
  // Set to true when table state is received via SSE from another window; suppresses one save cycle
  // to prevent an infinite broadcast loop (receive -> save -> broadcast -> receive -> ...).
  const sseStateReceivedRef = useRef(false);

  // Serialized table_state saves: only one PUT in flight at a time.
  const tableStateSaveInProgressRef = useRef(false);
  const pendingTableStateSaveRef = useRef(null);
  const saveTableState = async (data) => {
    if (tableStateSaveInProgressRef.current) {
      pendingTableStateSaveRef.current = data;
      return;
    }
    tableStateSaveInProgressRef.current = true;
    try {
      await apiSaveItem('table_state', data);
    } finally {
      tableStateSaveInProgressRef.current = false;
      const pending = pendingTableStateSaveRef.current;
      pendingTableStateSaveRef.current = null;
      if (pending) saveTableState(pending);
    }
  };

  useEffect(() => {
    if (!tableStateReadyRef.current) return;
    const r = routeRef.current;
    if (r?.view === 'gm-table' && r?.gmUid && r?.gmUid !== userRef.current?.uid) return;
    if (sseStateReceivedRef.current) { sseStateReceivedRef.current = false; return; }
    const timer = setTimeout(() => {
      saveTableState({
        id: 'current', elements: activeElements, featureCountdowns,
        tableBattleMods, fearCount, playerEmails, mapConfig,
        gmDisplayName: userRef.current?.displayName || '',
        _clientId: CLIENT_ID,
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [activeElements, featureCountdowns, tableBattleMods, fearCount, playerEmails, mapConfig]);

  const [isAdmin, setIsAdmin] = useState(false);
  // Multi-player room state
  const [myRooms, setMyRooms] = useState([]); // [{ gmUid, gmName }]
  const [connectedPlayers, setConnectedPlayers] = useState([]); // [{ uid, name, email, photoURL }]
  // Player-mode state (when viewing someone else's GM table)
  const [playerTableState, setPlayerTableState] = useState(null); // table state from SSE
  const [playerDiceRollQueue, setPlayerDiceRollQueue] = useState([]);
  const [playerDiceAck, setPlayerDiceAck] = useState(null);
  const [diceLog, setDiceLog] = useState([]);
  // GM preview-as-player mode: non-null email means the GM is previewing that player's view
  const [previewAsPlayerEmail, setPreviewAsPlayerEmail] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [tableFlash, setTableFlash] = useState(false);
  const userMenuRef = useRef(null);
  const prevTableCountRef = useRef(null);

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
    const envCount = activeElements.filter(e => e.elementType === 'environment').length;
    const advTypeCount = new Set(activeElements.filter(e => e.elementType === 'adversary').map(e => e.id)).size;
    const tableCount = envCount + advTypeCount;
    if (prevTableCountRef.current !== null && tableCount !== prevTableCountRef.current) {
      setTableFlash(true);
      setTimeout(() => setTableFlash(false), 1500);
    }
    prevTableCountRef.current = tableCount;
  }, [activeElements]);

  const handleGoogleSignIn = async () => {
    if (!auth) { console.error('Firebase auth not initialized — check .env credentials'); return; }
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Google Sign-In Error:', err);
    }
  };

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    setIsAdmin(false);
    setMyRooms([]);
    setConnectedPlayers([]);
    setPlayerTableState(null);
    setPlayerDiceRollQueue([]);
    setPlayerDiceAck(null);
    tableStateReadyRef.current = false;
    scenesLoadedRef.current = false;
    adventuresLoadedRef.current = false;
    scenesCacheRef.current = [];
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
    scenesLoadedRef.current = false;
    adventuresLoadedRef.current = false;
    scenesCacheRef.current = [];
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
  const lastLibraryPathRef = useRef('/library/adversaries');
  const scenesLoadedRef = useRef(false);
  const adventuresLoadedRef = useRef(false);
  const charactersLoadedRef = useRef(false);
  const scenesLoadPromiseRef = useRef(null);
  const adventuresLoadPromiseRef = useRef(null);
  const charactersLoadPromiseRef = useRef(null);
  const scenesCacheRef = useRef([]);
  const adventuresCacheRef = useRef([]);
  const charactersCacheRef = useRef([]);
  const charLoadResolversRef = useRef([]);

  // Load scenes on demand; resolve adversary/env IDs for scene chips.
  // Returns the scenes array (from cache if already loaded, or freshly loaded).
  const ensureScenesLoaded = useCallback(async () => {
    if (scenesLoadedRef.current) return scenesCacheRef.current;
    if (scenesLoadPromiseRef.current) return scenesLoadPromiseRef.current;
    const promise = (async () => {
      try {
        const result = await loadCollection('scenes', { limit: 1000 });
        const scenes = result.items || [];
        if (!userRef.current) return [];
        // Show scenes immediately so the UI feels instant; resolve refs in background for chip names.
        setData(prev => {
          if ((prev.scenes || []).length > 0) return prev;
          return { ...prev, scenes };
        });
        scenesLoadedRef.current = true;
        scenesCacheRef.current = scenes;

        const advIds = new Set();
        const envIds = new Set();
        for (const scene of scenes) {
          for (const envEntry of (scene.environments || [])) {
            if (typeof envEntry === 'string') envIds.add(envEntry);
          }
          for (const ref of (scene.adversaries || [])) {
            if (ref != null && !ref.data && ref.adversaryId) advIds.add(ref.adversaryId);
          }
        }
        if (advIds.size || envIds.size) {
          resolveItems({
            ...(advIds.size ? { adversaries: [...advIds] } : {}),
            ...(envIds.size ? { environments: [...envIds] } : {}),
          }).then(resolved => {
            if (!userRef.current) return;
            const resolvedAdvs = resolved.adversaries || [];
            const resolvedEnvs = resolved.environments || [];
            const resolvedAdvIds = new Set(resolvedAdvs.map(a => a.id));
            const resolvedEnvIds = new Set(resolvedEnvs.map(e => e.id));
            setData(prev => ({
              ...prev,
              adversaries: [...resolvedAdvs, ...(prev.adversaries || []).filter(a => !resolvedAdvIds.has(a.id))],
              environments: [...resolvedEnvs, ...(prev.environments || []).filter(e => !resolvedEnvIds.has(e.id))],
            }));
          }).catch(() => {});
        }
        return scenes;
      } finally {
        scenesLoadPromiseRef.current = null;
      }
    })();
    scenesLoadPromiseRef.current = promise;
    return promise;
  }, []);

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

  useEffect(() => {
    if (!auth) { setLoading(false); return; }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      userRef.current = currentUser;
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        if (window.location.pathname === '/' || window.location.pathname === '') {
          navigate('/library/adversaries', { replace: true });
        }
        // Fire table state and admin fetch in background; do not block render.
        loadTableState().then((items) => {
          if (!userRef.current) return;
          const tableState = items?.[0];
          setActiveElements(tableState?.elements || []);
          setFeatureCountdowns(tableState?.featureCountdowns || {});
          if (tableState?.tableBattleMods) setTableBattleMods(tableState.tableBattleMods);
          if (tableState?.fearCount != null) setFearCount(tableState.fearCount);
          if (Array.isArray(tableState?.playerEmails)) setPlayerEmails(tableState.playerEmails);
          if (tableState?.mapConfig) setMapConfig(mc => ({ ...mc, ...tableState.mapConfig }));
          tableStateReadyRef.current = true;
        }).catch(err => console.error('Failed to load table state:', err));
        fetchMe().then(({ isAdmin: admin }) => setIsAdmin(admin)).catch(() => {});
        fetchMyRooms().then(rooms => setMyRooms(rooms)).catch(() => {});
      }
    });
    return () => unsubscribe();
  }, [navigate]);

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

  // Derive whether the current user is viewing someone else's GM table (player mode)
  const isPlayer = route.view === 'gm-table' && !!route.gmUid && route.gmUid !== user?.uid;

  // GM can preview the table as a specific player (non-persisted; cleared on reload)
  const isPreviewMode = !isPlayer && !!previewAsPlayerEmail && route.view === 'gm-table';
  const effectiveIsPlayer = isPlayer || isPreviewMode;
  // Characters are assigned by email, so use email as the player identity for both real and preview mode
  const effectivePlayerEmail = isPlayer ? user?.email : (isPreviewMode ? previewAsPlayerEmail : undefined);

  // Declared early so SSE effects below can reference it in their dependency arrays
  const updateActiveElement = useCallback((instanceId, updates) => {
    setActiveElements(prev => prev.map(el => el.instanceId === instanceId ? { ...el, ...updates } : el));
  }, []);

  // Apply a table-op received from another client (GM SSE)
  const applyOp = useCallback((op) => {
    switch (op.op) {
      case 'update-element':
        setActiveElements(prev => prev.map(el => el.instanceId === op.instanceId ? { ...el, ...op.updates } : el));
        break;
      case 'add-elements':
        setActiveElements(prev => [...prev, ...op.elements]);
        break;
      case 'remove-element':
        setActiveElements(prev => prev.filter(el => el.instanceId !== op.instanceId));
        break;
      case 'clear-table':
        setActiveElements(prev => prev.filter(el => el.elementType === 'character'));
        setFeatureCountdowns({});
        break;
      case 'set-fear':
        setFearCount(op.fearCount);
        break;
      case 'set-countdown':
        setFeatureCountdowns(prev => ({ ...prev, [op.key]: op.value }));
        break;
      case 'set-battle-mods':
        setTableBattleMods(op.tableBattleMods);
        break;
      case 'set-player-emails':
        setPlayerEmails(op.playerEmails);
        break;
      case 'update-base-data': {
        const { elementId, newBaseData } = op;
        setActiveElements(prev => prev.map(el => {
          if (el.id !== elementId) return el;
          const runtime = {};
          RUNTIME_KEYS.forEach(k => { if (k in el) runtime[k] = el[k]; });
          return { ...newBaseData, ...runtime };
        }));
        break;
      }
      case 'set-map':
        setMapConfig({ mapImageUrl: op.mapImageUrl ?? null, mapDimension: op.mapDimension ?? 'width', mapSizeFt: op.mapSizeFt ?? 100, mapImageNaturalWidth: op.mapImageNaturalWidth ?? null, mapImageNaturalHeight: op.mapImageNaturalHeight ?? null });
        if (op.resetTokenPositions) setActiveElements(prev => prev.map(el => ({ ...el, tokenX: null, tokenY: null })));
        break;
    }
  }, []);

  // Apply a table-op received from the GM (Player SSE)
  const applyPlayerOp = useCallback((op) => {
    setPlayerTableState(prev => applyPlayerTableOp(op, prev));
  }, []);

  // Redirect /gm-table (no UID) to /gm-table/:uid after sign-in
  useEffect(() => {
    if (user && route.view === 'gm-table' && !route.gmUid) {
      navigate(`/gm-table/${user.uid}`, { replace: true });
    }
  }, [user, route.view, route.gmUid, navigate]);

  // GM SSE: receive player presence, character updates, and state/dice syncs from other GM windows
  useEffect(() => {
    if (!user || route.view !== 'gm-table' || isPlayer) return;
    let es;
    let reconnectTimer;
    const connect = async () => {
      const token = await getAuthToken();
      if (!token || !userRef.current) return;
      es = new EventSource(`/api/room/my/players?token=${encodeURIComponent(token)}`);
      es.addEventListener('presence', (e) => {
        setConnectedPlayers(JSON.parse(e.data).players || []);
      });
      es.addEventListener('character-update', (e) => {
        const { instanceId, updates } = JSON.parse(e.data);
        updateActiveElement(instanceId, updates);
      });
      es.addEventListener('character-added', (e) => {
        const character = JSON.parse(e.data);
        setActiveElements(prev => [...prev, character]);
      });
      // Sync table state broadcast from another GM window (e.g. primary window saving changes)
      es.addEventListener('state', (e) => {
        const state = JSON.parse(e.data);
        if (state._clientId === CLIENT_ID) return;
        sseStateReceivedRef.current = true;
        if (Array.isArray(state.elements)) setActiveElements(state.elements);
        if (state.fearCount != null) setFearCount(state.fearCount);
        if (state.featureCountdowns != null) setFeatureCountdowns(state.featureCountdowns);
        if (state.tableBattleMods != null) setTableBattleMods(state.tableBattleMods);
        if (Array.isArray(state.playerEmails)) setPlayerEmails(state.playerEmails);
        if (state.mapConfig != null) setMapConfig(mc => ({ ...mc, ...state.mapConfig }));
      });
      // Real-time table operations from another GM window
      es.addEventListener('table-op', (e) => {
        const op = JSON.parse(e.data);
        if (op._clientId === CLIENT_ID) return;
        applyOp(op);
      });
      // Dice roll from a player or another GM window (skip own rolls — already handled via HTTP response)
      es.addEventListener('dice-roll', (e) => {
        const roll = JSON.parse(e.data);
        if (roll._clientId === CLIENT_ID) return;
        setPlayerDiceRollQueue(prev => [
          ...prev,
          { ...roll, _fromSSE: true, _rollId: `sse-${Date.now()}-${Math.random().toString(36).slice(2)}` },
        ]);
      });
      es.addEventListener('dice-ack', (e) => {
        const ack = JSON.parse(e.data);
        if (ack._clientId === CLIENT_ID) return; // Skip own ack echo
        setPlayerDiceAck(ack);
      });
      es.addEventListener('roll-history', (e) => {
        const { rolls } = JSON.parse(e.data);
        if (Array.isArray(rolls) && rolls.length) {
          setDiceLog(rolls.map(r => ({ ...r, _logId: r._logId || `hist-${r.timestamp || Math.random()}` })));
          // Restore unacked rolls as banners so the GM can still acknowledge them after reload
          const unacked = rolls.filter(r => !r._acked && r._rollDbId);
          if (unacked.length) {
            setPlayerDiceRollQueue(prev => {
              const existingIds = new Set(prev.map(r => r._rollId).filter(Boolean));
              const toAdd = unacked
                .filter(r => !existingIds.has(`hist-${r._rollDbId}`))
                .map(r => ({ ...r, _fromHistory: true, _rollId: `hist-${r._rollDbId}` }));
              return toAdd.length ? [...prev, ...toAdd] : prev;
            });
          }
        }
      });
      es.onerror = () => { es.close(); reconnectTimer = setTimeout(connect, 3000); };
    };
    connect();
    return () => { es?.close(); if (reconnectTimer) clearTimeout(reconnectTimer); };
  }, [user?.uid, route.view, isPlayer, updateActiveElement, applyOp]);

  // Player SSE: receive table state and events from GM
  useEffect(() => {
    if (!isPlayer || !user || !route.gmUid) return;
    let es;
    let reconnectTimer;
    const connect = async () => {
      const token = await getAuthToken();
      if (!token || !userRef.current) return;
      es = new EventSource(`/api/room/${route.gmUid}/stream?token=${encodeURIComponent(token)}`);
      es.addEventListener('state', (e) => {
        const state = JSON.parse(e.data);
        setPlayerTableState(state);
        // Ensure a nav tab exists for this GM's room now that we've confirmed access.
        setMyRooms(prev => {
          if (prev.some(r => r.gmUid === route.gmUid)) return prev;
          return [...prev, { gmUid: route.gmUid, gmName: state.gmDisplayName || '' }];
        });
      });
      es.addEventListener('character-update', (e) => {
        const { instanceId, updates } = JSON.parse(e.data);
        setPlayerTableState(prev => prev ? {
          ...prev,
          elements: (prev.elements || []).map(el => el.instanceId === instanceId ? { ...el, ...updates } : el),
        } : prev);
      });
      es.addEventListener('character-added', (e) => {
        const character = JSON.parse(e.data);
        setPlayerTableState(prev => prev ? { ...prev, elements: [...(prev.elements || []), character] } : { elements: [character] });
      });
      es.addEventListener('dice-roll', (e) => {
        const roll = JSON.parse(e.data);
        if (roll._clientId === CLIENT_ID) return; // Skip own roll (already handled via HTTP response)
        setPlayerDiceRollQueue(prev => [
          ...prev,
          { ...roll, _fromSSE: true, _rollId: `sse-${Date.now()}-${Math.random().toString(36).slice(2)}` },
        ]);
      });
      es.addEventListener('dice-ack', (e) => {
        setPlayerDiceAck(JSON.parse(e.data));
      });
      es.addEventListener('roll-history', (e) => {
        const { rolls } = JSON.parse(e.data);
        if (Array.isArray(rolls) && rolls.length) {
          setDiceLog(rolls.map(r => ({ ...r, _logId: r._logId || `hist-${r.timestamp || Math.random()}` })));
          // Restore unacked rolls as banners so players can still see pending rolls after reconnect
          const unacked = rolls.filter(r => !r._acked && r._rollDbId);
          if (unacked.length) {
            setPlayerDiceRollQueue(prev => {
              const existingIds = new Set(prev.map(r => r._rollId).filter(Boolean));
              const toAdd = unacked
                .filter(r => !existingIds.has(`hist-${r._rollDbId}`))
                .map(r => ({ ...r, _fromHistory: true, _rollId: `hist-${r._rollDbId}` }));
              return toAdd.length ? [...prev, ...toAdd] : prev;
            });
          }
        }
      });
      // Real-time table operations from the GM
      es.addEventListener('table-op', (e) => {
        const op = JSON.parse(e.data);
        if (op._clientId === CLIENT_ID) return;
        applyPlayerOp(op);
      });
      es.onerror = () => { es.close(); reconnectTimer = setTimeout(connect, 3000); };
    };
    connect();
    return () => { es?.close(); if (reconnectTimer) clearTimeout(reconnectTimer); };
  }, [isPlayer, user?.uid, route.gmUid, applyPlayerOp]);

  // Remember last library tab so we can return there when navigating back from Game Table
  useEffect(() => {
    if (route.view === 'library' && route.tab) {
      lastLibraryPathRef.current = `/library/${route.tab}`;
    }
  }, [route.view, route.tab]);

  /** Called by LibraryView whenever its hook fetches a new page of adversaries/environments.
   *  Merges with previously resolved items (from fetchAllCollections) so scene
   *  reference resolution in ItemCard and ItemDetailView keeps working. */
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
      console.error(`saveImage(${collectionName}, ${id}) failed:`, err);
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
      RUNTIME_KEYS.forEach(k => { if (k in el) runtime[k] = el[k]; });
      return { ...newBaseData, ...runtime };
    }));
  };

  // Collect all DB-referenced IDs from a scene (and nested scenes) for batch resolution.
  // visited prevents infinite recursion from circular scene references.
  function collectSceneIds(scene, scenesById, visited = new Set()) {
    if (visited.has(scene.id)) return { adversaryIds: [], environmentIds: [] };
    visited.add(scene.id);

    const adversaryIds = new Set();
    const environmentIds = new Set();

    (scene.environments || []).forEach(e => { if (typeof e === 'string') environmentIds.add(e); });
    (scene.adversaries || []).forEach(ref => { if (ref != null && !ref.data && ref.adversaryId) adversaryIds.add(ref.adversaryId); });

    (scene.scenes || []).forEach(nestedId => {
      const nested = scenesById[nestedId];
      if (!nested) return;
      const { adversaryIds: a, environmentIds: e } = collectSceneIds(nested, scenesById, visited);
      a.forEach(id => adversaryIds.add(id));
      e.forEach(id => environmentIds.add(id));
    });

    return { adversaryIds: [...adversaryIds], environmentIds: [...environmentIds] };
  }

  // Expand a scene into table elements using pre-resolved data maps.
  // visited prevents infinite recursion from circular scene references.
  // rootDamageBoost is inherited from the root scene's battleMods (only top-level scene sets it).
  function expandSceneWithResolved(scene, scenesById, adversariesById, environmentsById, visited = new Set(), depth = 0, rootDamageBoost = null) {
    if (visited.has(scene.id) || depth > 10) return [];
    visited.add(scene.id);

    // Only the root scene (depth 0) sets the damage boost; nested scenes inherit it.
    const damageBoost = depth === 0
      ? (scene.battleMods?.damageBoostD4 ? 'd4' : scene.battleMods?.damageBoostStatic ? 'static' : scene.battleMods?.damageBoostPlusOne ? 'plusOne' : null)
      : rootDamageBoost;

    const elements = [];

    (scene.environments || []).forEach(envEntry => {
      if (envEntry == null) return;
      if (typeof envEntry === 'object' && envEntry.data) {
        elements.push({ id: envEntry.data.id || generateId(), ...envEntry.data, instanceId: generateId(), elementType: 'environment' });
      } else {
        const env = environmentsById[envEntry];
        if (env) elements.push({ ...env, instanceId: generateId(), elementType: 'environment' });
      }
    });

    (scene.adversaries || []).forEach(advRef => {
      if (advRef == null) return;
      const adv = advRef.data ? { id: advRef.data.id || generateId(), ...advRef.data } : adversariesById[advRef.adversaryId];
      if (adv) {
        for (let i = 0; i < (advRef.count || 1); i++) {
          elements.push({ ...adv, instanceId: generateId(), elementType: 'adversary', currentHp: adv.hp_max || 0, currentStress: 0, conditions: '', ...(damageBoost ? { _damageBoost: damageBoost } : {}) });
        }
      }
    });

    (scene.scenes || []).forEach(nestedId => {
      const nested = scenesById[nestedId];
      if (nested) elements.push(...expandSceneWithResolved(nested, scenesById, adversariesById, environmentsById, visited, depth + 1, damageBoost));
    });

    return elements;
  }

  const doAddToTable = async (item, collectionName) => {
    const newElements = [];

    if (collectionName === 'adversaries' || collectionName === 'environments') {
      let tableItem = item;
      if (isOwnItem(item)) {
        // Own item: just record the play
        recordPlay(collectionName, item.id).catch(err => console.warn('recordPlay failed:', err));
      } else {
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
        newElements.push({ ...tableItem, instanceId: generateId(), elementType: 'adversary', currentHp: tableItem.hp_max || 0, currentStress: 0, conditions: '' });
      } else {
        newElements.push({ ...tableItem, instanceId: generateId(), elementType: 'environment' });
      }
    } else if (collectionName === 'scenes') {
      const scenes = await ensureScenesLoaded();
      const scenesById = Object.fromEntries(scenes.map(s => [s.id, s]));
      const { adversaryIds, environmentIds } = collectSceneIds(item, scenesById);
      const resolved = (adversaryIds.length || environmentIds.length)
        ? await resolveItems({ adversaries: adversaryIds, environments: environmentIds }, { adopt: true })
        : { adversaries: [], environments: [] };
      const adversariesById = Object.fromEntries(resolved.adversaries.map(a => [a.id, a]));
      const environmentsById = Object.fromEntries(resolved.environments.map(e => [e.id, e]));
      newElements.push(...expandSceneWithResolved(item, scenesById, adversariesById, environmentsById));
    } else if (collectionName === 'characters') {
      const { is_public, _source, ...charData } = item;
      newElements.push({ ...charData, instanceId: generateId(), elementType: 'character' });
    } else if (collectionName === 'adventures') {
      const scenes = await ensureScenesLoaded();
      await ensureAdventuresLoaded();
      const scenesById = Object.fromEntries(scenes.map(s => [s.id, s]));
      const allAdvIds = new Set();
      const allEnvIds = new Set();
      (item.scenes || []).forEach(sceneId => {
        const scene = scenesById[sceneId];
        if (scene) {
          const { adversaryIds, environmentIds } = collectSceneIds(scene, scenesById);
          adversaryIds.forEach(id => allAdvIds.add(id));
          environmentIds.forEach(id => allEnvIds.add(id));
        }
      });
      const resolved = (allAdvIds.size || allEnvIds.size)
        ? await resolveItems({ adversaries: [...allAdvIds], environments: [...allEnvIds] }, { adopt: true })
        : { adversaries: [], environments: [] };
      const adversariesById = Object.fromEntries(resolved.adversaries.map(a => [a.id, a]));
      const environmentsById = Object.fromEntries(resolved.environments.map(e => [e.id, e]));
      (item.scenes || []).forEach(sceneId => {
        const scene = scenesById[sceneId];
        if (scene) newElements.push(...expandSceneWithResolved(scene, scenesById, adversariesById, environmentsById));
      });
    }

    setActiveElements(prev => [...prev, ...newElements]);
    return newElements;
  };

  const addToTable = (item, collectionName) => {
    // Intercept scene adds: if the scene has active user-controlled budget factors,
    // ask the user whether to apply them to the table before proceeding.
    if (collectionName === 'scenes') {
      const mods = item?.battleMods;
      const hasActiveMods = mods && (mods.lessDifficult || mods.slightlyMoreDangerous || mods.damageBoostPlusOne || mods.damageBoostD4 || mods.damageBoostStatic || mods.moreDangerous);
      if (hasActiveMods) {
        setPendingSceneAdd({ scene: item });
        return;
      }
    }
    return doAddToTable(item, collectionName);
  };

  const removeActiveElement = (instanceId) => {
    setActiveElements(prev => prev.filter(el => el.instanceId !== instanceId));
  };

  const clearTable = () => {
    setActiveElements(prev => prev.filter(el => el.elementType === 'character'));
    setFeatureCountdowns({});
  };

  // --- Broadcasting wrappers (Phase 3: operational sync) ---
  // broadcastOp sends a lightweight op to all room clients via the server.
  // Only fires in GM mode (not player, not preview).
  const broadcastOp = (op) => {
    const r = routeRef.current;
    if (!r || r.view !== 'gm-table' || !r.gmUid || r.gmUid !== userRef.current?.uid) return;
    if (previewAsPlayerEmail) return;
    postTableOp(op);
  };

  const broadcastingUpdateActiveElement = (instanceId, updates) => {
    updateActiveElement(instanceId, updates);
    broadcastOp({ op: 'update-element', instanceId, updates });
  };

  const broadcastingRemoveActiveElement = (instanceId) => {
    removeActiveElement(instanceId);
    broadcastOp({ op: 'remove-element', instanceId });
  };

  const broadcastingSetFearCount = (valueOrFn) => {
    let resolved;
    setFearCount(prev => {
      resolved = typeof valueOrFn === 'function' ? valueOrFn(prev) : valueOrFn;
      return resolved;
    });
    broadcastOp({ op: 'set-fear', fearCount: resolved });
  };

  const broadcastingSetTableBattleMods = (valueOrFn) => {
    let resolved;
    setTableBattleMods(prev => {
      resolved = typeof valueOrFn === 'function' ? valueOrFn(prev) : valueOrFn;
      return resolved;
    });
    broadcastOp({ op: 'set-battle-mods', tableBattleMods: resolved });
  };

  const broadcastingSetPlayerEmails = (valueOrFn) => {
    let resolved;
    setPlayerEmails(prev => {
      resolved = typeof valueOrFn === 'function' ? valueOrFn(prev) : valueOrFn;
      return resolved;
    });
    broadcastOp({ op: 'set-player-emails', playerEmails: resolved });
  };

  const broadcastingUpdateCountdown = (cardKey, featureKey, cdIdx, value) => {
    const key = `${cardKey}|${featureKey}|${cdIdx}`;
    setFeatureCountdowns(prev => ({ ...prev, [key]: value }));
    broadcastOp({ op: 'set-countdown', key, value });
  };

  const broadcastingClearTable = () => {
    clearTable();
    broadcastOp({ op: 'clear-table' });
  };

  const broadcastingDoAddToTable = async (item, collectionName) => {
    const newElements = await doAddToTable(item, collectionName);
    if (newElements?.length) broadcastOp({ op: 'add-elements', elements: newElements });
    return newElements;
  };

  const broadcastingAddToTable = (item, collectionName) => {
    if (collectionName === 'scenes') {
      const mods = item?.battleMods;
      const hasActiveMods = mods && (mods.lessDifficult || mods.slightlyMoreDangerous || mods.damageBoostPlusOne || mods.damageBoostD4 || mods.damageBoostStatic || mods.moreDangerous);
      if (hasActiveMods) {
        setPendingSceneAdd({ scene: item });
        return;
      }
    }
    return broadcastingDoAddToTable(item, collectionName);
  };

  const broadcastingUpdateActiveElementsBaseData = (predicate, newBaseData) => {
    const matching = activeElements.find(predicate);
    updateActiveElementsBaseData(predicate, newBaseData);
    if (matching) broadcastOp({ op: 'update-base-data', elementId: matching.id, newBaseData });
  };

  const broadcastingSetMapConfig = (newConfig, resetTokenPositions = false) => {
    const merged = { ...mapConfig, ...newConfig };
    setMapConfig(merged);
    if (resetTokenPositions) setActiveElements(prev => prev.map(el => ({ ...el, tokenX: null, tokenY: null })));
    broadcastOp({ op: 'set-map', ...merged, resetTokenPositions });
  };

  // Player callbacks — send updates to server + apply optimistically
  const handlePlayerCharacterUpdate = useCallback(async (instanceId, updates) => {
    if (!route.gmUid) return;
    setPlayerTableState(prev => prev ? {
      ...prev,
      elements: (prev.elements || []).map(el => el.instanceId === instanceId ? { ...el, ...updates } : el),
    } : prev);
    try {
      await postCharacterUpdate(route.gmUid, instanceId, updates);
    } catch (err) {
      console.error('postCharacterUpdate failed:', err);
    }
  }, [route.gmUid]);

  const handlePlayerAddCharacter = useCallback(async (charData) => {
    if (!route.gmUid) return;
    try {
      await postAddCharacter(route.gmUid, charData);
      // State update is handled by the character-added SSE event that the server broadcasts
      // to all room clients (including this player). Updating here too would double-add.
    } catch (err) {
      console.error('postAddCharacter failed:', err);
    }
  }, [route.gmUid]);

  // GM impersonation: add a character on behalf of the previewed player, directly into activeElements.
  // Uses the real addToTable (not the no-op shim passed to GMTableView in preview mode).
  const handleGmImpersonateAddCharacter = (charData) => {
    const { name, playerName, tier, maxHope, maxHp, maxStress } = charData;
    broadcastingAddToTable({
      elementType: 'character',
      name,
      playerName,
      tier: tier ?? 1,
      hope: maxHope ?? 6,
      maxHope: maxHope ?? 6,
      maxHp: maxHp ?? 6,
      maxStress: maxStress ?? 6,
      currentHp: maxHp ?? 6,
      currentStress: 0,
      conditions: '',
      assignedPlayerEmail: previewAsPlayerEmail || undefined,
    }, 'characters');
  };

  // GM dice broadcast callbacks — include _clientId so the sender can skip its own echo
  const handleDiceAckBroadcast = useCallback((ackData) => {
    postDiceAck({ ...ackData, _clientId: CLIENT_ID }).catch(err => console.warn('postDiceAck failed:', err));
  }, []);

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>;

  return (
    <div className="h-[100dvh] bg-slate-900 text-slate-200 font-sans flex flex-col overflow-hidden">
      {user && (
        <nav className="bg-slate-950 border-b border-slate-800 p-4 flex items-center justify-between shadow-md z-[70]">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-red-500 tracking-wider flex items-center gap-2">
              <Swords size={24} /> DAGGERTOP
            </h1>
            <div className="flex items-center gap-2">
              <NavBtn icon={<BookOpen />} label="Library" active={route.view === 'library'} onClick={() => navigate(lastLibraryPathRef.current)} />
              <NavBtn
                icon={<LayoutDashboard />}
                label="My Game Table"
                active={route.view === 'gm-table' && (route.gmUid === user?.uid || !route.gmUid)}
                onClick={() => navigate(`/gm-table/${user?.uid || ''}`)}
                pulse={tableFlash}
              />
              {myRooms.map(({ gmUid, gmName }) => (
                <NavBtn
                  key={gmUid}
                  icon={<LayoutDashboard />}
                  label={gmName ? `${gmName}'s Table` : 'GM Table'}
                  active={route.view === 'gm-table' && route.gmUid === gmUid}
                  onClick={() => navigate(`/gm-table/${gmUid}`)}
                />
              ))}
              {!isPlayer && (() => {
                const advElements = activeElements.filter(e => e.elementType === 'adversary');
                const envCount = activeElements.filter(e => e.elementType === 'environment').length;
                if (!advElements.length && !envCount) return null;
                const countById = {};
                const roleAndTierById = {};
                advElements.forEach(e => {
                  countById[e.id] = (countById[e.id] || 0) + 1;
                  roleAndTierById[e.id] = { role: e.role || 'standard', tier: e.tier ?? 1 };
                });
                const tableAdvSummary = Object.entries(countById).map(([id, count]) => ({ ...roleAndTierById[id], count }));
                const bp = computeBattlePoints(tableAdvSummary, partySize);
                const parts = [];
                if (bp > 0) parts.push(`${bp} BP`);
                if (envCount) parts.push(`${envCount} env${envCount !== 1 ? 's' : ''}`);
                if (advElements.length) parts.push(`${advElements.length} adversar${advElements.length !== 1 ? 'ies' : 'y'}`);
                return (
                  <span className={`text-xs font-mono transition-colors duration-300 ${tableFlash ? 'text-yellow-400' : 'text-slate-500'}`}>
                    {parts.join(' · ')}
                  </span>
                );
              })()}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            {importStatus && <span className="text-xs text-green-400 font-medium">{importStatus}</span>}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-800 transition-colors"
              >
                <div className="flex flex-col items-end">
                  <span className="text-green-500 font-medium">{user.displayName || user.email || 'Signed In'}</span>
                  <span className="text-[10px] opacity-60 font-mono">{user.email}</span>
                </div>
                <ChevronDown size={14} className={`text-slate-500 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1">
                  <button
                    onClick={handleExport}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    <Download size={15} /> Export JSON
                  </button>
                  <label className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer">
                    <Upload size={15} /> Import JSON
                    <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                  </label>
                  <div className="border-t border-slate-700 my-1" />
                  <button
                    onClick={handleDeleteAllData}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-orange-400 hover:bg-slate-700 hover:text-orange-300 transition-colors"
                  >
                    <Trash2 size={15} /> Delete All Data
                  </button>
                  <div className="border-t border-slate-700 my-1" />
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-slate-700 hover:text-red-300 transition-colors"
                  >
                    <LogOut size={15} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>
      )}

      <main className="flex-1 overflow-hidden flex flex-col">
        {!user || route.view === 'home' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-slate-900 to-slate-950">
            <Swords size={64} className="text-red-500 mb-6" />
            <h1 className="text-4xl font-bold text-white mb-2">Daggertop</h1>
            <p className="text-slate-400 mb-8 text-center max-w-md">Build adversaries, environments, and run your encounters seamlessly with integrated action tracking.</p>
            <button
              onClick={handleGoogleSignIn}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-red-900/20"
            >
              <Users size={20} /> Sign In with Google
            </button>
          </div>
        ) : (
          <>
            <div
              className="flex-1 overflow-hidden flex flex-col"
              style={{ display: route.view === 'library' ? 'flex' : 'none' }}
              aria-hidden={route.view !== 'library'}
            >
              <LibraryView
                key={libraryKey}
                data={data}
                saveItem={saveItem}
                saveImage={saveImage}
                deleteItem={deleteItem}
                cloneItem={cloneItem}
                addToTable={broadcastingAddToTable}
                route={
                  route.view === 'library'
                    ? route
                    : {
                        view: 'library',
                        tab: (lastLibraryPathRef.current.match(/^\/library\/([^/]+)/)?.[1]) || 'adversaries',
                        itemId: null,
                      }
                }
                navigate={navigate}
                onItemsChange={syncDataToApp}
                onMergeAdversary={mergeAdversaryIntoData}
                isAdmin={isAdmin}
                partySize={partySize}
                partyTier={partyTier}
                characters={characters}
                ensureScenesLoaded={ensureScenesLoaded}
                ensureAdventuresLoaded={ensureAdventuresLoaded}
                ensureCharactersLoaded={ensureCharactersLoaded}
              />
            </div>
            <div
              className="flex-1 overflow-hidden flex flex-col"
              style={{ display: route.view === 'gm-table' ? 'flex' : 'none' }}
              aria-hidden={route.view !== 'gm-table'}
            >
              <GMTableView
                activeElements={isPlayer ? (playerTableState?.elements || []) : resolvedActiveElements}
                updateActiveElement={isPlayer ? handlePlayerCharacterUpdate : broadcastingUpdateActiveElement}
                removeActiveElement={effectiveIsPlayer ? () => {} : broadcastingRemoveActiveElement}
                updateActiveElementsBaseData={effectiveIsPlayer ? () => {} : broadcastingUpdateActiveElementsBaseData}
                data={data}
                saveItem={effectiveIsPlayer ? (col, item) => col === 'characters' ? saveItem(col, item) : undefined : saveItem}
                saveImage={effectiveIsPlayer ? (col, id, url, opts) => col === 'characters' ? saveImage(col, id, url, opts) : undefined : saveImage}
                addToTable={effectiveIsPlayer ? () => {} : broadcastingAddToTable}
                onMergeAdversary={mergeAdversaryIntoData}
                user={user}
                ensureScenesLoaded={ensureScenesLoaded}
                ensureAdventuresLoaded={ensureAdventuresLoaded}
                ensureCharactersLoaded={ensureCharactersLoaded}
                route={route}
                navigate={navigate}
                featureCountdowns={isPlayer ? (playerTableState?.featureCountdowns || {}) : featureCountdowns}
                updateCountdown={effectiveIsPlayer ? () => {} : broadcastingUpdateCountdown}
                partySize={partySize}
                partyTier={partyTier}
                characters={characters}
                tableBattleMods={isPlayer ? (playerTableState?.tableBattleMods || tableBattleMods) : tableBattleMods}
                setTableBattleMods={effectiveIsPlayer ? () => {} : broadcastingSetTableBattleMods}
                fearCount={isPlayer ? (playerTableState?.fearCount ?? 0) : fearCount}
                setFearCount={effectiveIsPlayer ? () => {} : broadcastingSetFearCount}
                clearTable={effectiveIsPlayer ? () => {} : broadcastingClearTable}
                isPlayer={effectiveIsPlayer}
                playerEmail={effectivePlayerEmail}
                connectedPlayers={connectedPlayers}
                playerEmails={playerEmails}
                setPlayerEmails={effectiveIsPlayer ? () => {} : broadcastingSetPlayerEmails}
                gmUid={route.gmUid || user?.uid}
                onPlayerAddCharacter={isPlayer ? handlePlayerAddCharacter : (isPreviewMode ? handleGmImpersonateAddCharacter : undefined)}
                playerDiceRollQueue={playerDiceRollQueue}
                setPlayerDiceRollQueue={setPlayerDiceRollQueue}
                playerDiceAck={playerDiceAck}
                setPlayerDiceAck={setPlayerDiceAck}
                onDiceAckBroadcast={!effectiveIsPlayer ? handleDiceAckBroadcast : undefined}
                previewAsPlayerEmail={isPreviewMode ? previewAsPlayerEmail : null}
                onPreviewAsPlayer={!effectiveIsPlayer ? setPreviewAsPlayerEmail : undefined}
                onExitPreview={isPreviewMode ? () => setPreviewAsPlayerEmail(null) : undefined}
                diceLog={diceLog}
                setDiceLog={setDiceLog}
                mapConfig={isPlayer ? (playerTableState?.mapConfig ?? DEFAULT_MAP_CONFIG) : mapConfig}
                onMapConfigChange={effectiveIsPlayer ? () => {} : broadcastingSetMapConfig}
              />
            </div>
          </>
        )}
      </main>
      {pendingSceneAdd && (
        <SceneAdoptDialog
          scene={pendingSceneAdd.scene}
          currentTableMods={tableBattleMods}
          onApply={() => {
            broadcastingSetTableBattleMods({ ...pendingSceneAdd.scene.battleMods });
            broadcastingDoAddToTable(pendingSceneAdd.scene, 'scenes');
            setPendingSceneAdd(null);
          }}
          onKeep={() => {
            broadcastingDoAddToTable(pendingSceneAdd.scene, 'scenes');
            setPendingSceneAdd(null);
          }}
          onCancel={() => setPendingSceneAdd(null)}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
