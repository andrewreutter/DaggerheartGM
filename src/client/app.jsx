import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { signInWithPopup, signOut, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';
import { Swords, BookOpen, LayoutDashboard, Users, ChevronDown, LogOut, Upload, Download, Trash2 } from 'lucide-react';

import { auth, loadCollection, loadTableState, resolveItems, saveItem as apiSaveItem, deleteItem as apiDeleteItem, cloneItemToLibrary, recordPlay } from './lib/api.js';
import { generateId } from './lib/helpers.js';

const LIBRARY_FILTERS_KEY = 'dh_libraryFilters';
const PAGE_LIMIT = 20;
const NON_PAGINATED_COLLECTIONS = ['groups', 'scenes', 'adventures'];

const FILTER_DEFAULTS = { includeByTab: {}, search: '', tierByTab: {}, typeByTab: {} };

function loadStoredFilters() {
  try {
    const stored = localStorage.getItem(LIBRARY_FILTERS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migrate old flat fields to per-tab maps
      if ('type' in parsed && !('typeByTab' in parsed)) { parsed.typeByTab = {}; delete parsed.type; }
      if ('include' in parsed && !('includeByTab' in parsed)) { parsed.includeByTab = {}; delete parsed.include; }
      if ('tier' in parsed && !('tierByTab' in parsed)) { parsed.tierByTab = {}; delete parsed.tier; }
      return { ...FILTER_DEFAULTS, ...parsed };
    }
  } catch {}
  return { ...FILTER_DEFAULTS };
}
import { useRouter } from './lib/router.js';
import { NavBtn } from './components/NavBtn.jsx';
import { LibraryView } from './components/LibraryView.jsx';
import { GMTableView } from './components/GMTableView.jsx';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { route, navigate } = useRouter();

  const [data, setData] = useState({
    adversaries: [],
    environments: [],
    groups: [],
    scenes: [],
    adventures: []
  });

  // Pagination metadata per collection: { totalCount, dbCount }
  const [collectionMeta, setCollectionMeta] = useState({
    adversaries: { totalCount: 0, dbCount: 0, loading: true },
    environments: { totalCount: 0, dbCount: 0, loading: true },
    groups: { totalCount: 0, dbCount: 0, loading: true },
    scenes: { totalCount: 0, dbCount: 0, loading: true },
    adventures: { totalCount: 0, dbCount: 0, loading: true },
  });

  // Current page offset for the active library tab (adversaries/environments only)
  const [paginationOffset, setPaginationOffset] = useState(0);

  // Own + SRD + public items for adversaries/environments — used by Feature Library panel
  const [allItemsData, setAllItemsData] = useState({ adversaries: [], environments: [] });

  const [activeElements, setActiveElements] = useState([]);
  const [whiteboardEmbed, setWhiteboardEmbed] = useState('');
  const [rolzRoomName, setRolzRoomName] = useState('');
  const [rolzUsername, setRolzUsername] = useState('');
  const [rolzPassword, setRolzPassword] = useState('');
  const [featureCountdowns, setFeatureCountdowns] = useState({});
  const tableStateReadyRef = useRef(false);
  const [libraryFilters, setLibraryFilters] = useState(loadStoredFilters);

  useEffect(() => {
    if (!tableStateReadyRef.current) return;
    const timer = setTimeout(() => {
      apiSaveItem('table_state', { id: 'current', elements: activeElements, whiteboardEmbed, rolzRoomName, rolzUsername, rolzPassword, featureCountdowns });
    }, 800);
    return () => clearTimeout(timer);
  }, [activeElements, whiteboardEmbed, rolzRoomName, rolzUsername, rolzPassword, featureCountdowns]);

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
    tableStateReadyRef.current = false;
    setActiveElements([]);
    apiDeleteItem('table_state', 'current').catch(() => {});
    try {
      await signOut(auth);
      navigate('/');
    } catch (err) {
      console.error('Sign-Out Error:', err);
    }
  };

  const handleDeleteAllData = async () => {
    setUserMenuOpen(false);
    const collections = ['adversaries', 'environments', 'groups', 'scenes', 'adventures'];
    // Fetch all own items across all collections to count and delete
    const allOwn = await Promise.all(collections.map(col =>
      loadCollection(col, { limit: 10000 }).then(r => ({ col, items: r.items.filter(i => !i._source || i._source === 'own') }))
    ));
    const totalItems = allOwn.reduce((sum, { items }) => sum + items.length, 0);
    if (!window.confirm(`Delete all ${totalItems} item(s)? This cannot be undone.`)) return;
    for (const { col, items } of allOwn) {
      for (const item of items) {
        await apiDeleteItem(col, item.id);
      }
    }
    setData({ adversaries: [], environments: [], groups: [], scenes: [], adventures: [] });
    setCollectionMeta({
      adversaries: { totalCount: 0, dbCount: 0, loading: false },
      environments: { totalCount: 0, dbCount: 0, loading: false },
      groups: { totalCount: 0, dbCount: 0, loading: false },
      scenes: { totalCount: 0, dbCount: 0, loading: false },
      adventures: { totalCount: 0, dbCount: 0, loading: false },
    });
    setActiveElements([]);
    tableStateReadyRef.current = false;
    apiDeleteItem('table_state', 'current').catch(() => {});
    tableStateReadyRef.current = true;
  };

  const handleExport = async () => {
    setUserMenuOpen(false);
    const collections = ['adversaries', 'environments', 'groups', 'scenes', 'adventures'];
    const allData = await Promise.all(collections.map(col =>
      loadCollection(col, { limit: 10000 }).then(r => [col, r.items.filter(i => !i._source || i._source === 'own')])
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
        const collections = ['adversaries', 'environments', 'groups', 'scenes', 'adventures'];
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
  const libraryFiltersRef = useRef(libraryFilters);
  const paginationOffsetRef = useRef(0);

  // Keep refs in sync for use inside async callbacks
  useEffect(() => { libraryFiltersRef.current = libraryFilters; }, [libraryFilters]);
  useEffect(() => { paginationOffsetRef.current = paginationOffset; }, [paginationOffset]);

  // Load a single collection into data state, respecting pagination for adversaries/environments
  const fetchCollection = async (collection, opts = {}) => {
    const isPaginated = !NON_PAGINATED_COLLECTIONS.includes(collection);
    const filters = opts.filters || libraryFiltersRef.current;
    const offset = opts.offset !== undefined ? opts.offset : (isPaginated ? paginationOffsetRef.current : 0);
    const limit = isPaginated ? PAGE_LIMIT : 1000;

    setCollectionMeta(prev => ({
      ...prev,
      [collection]: { ...prev[collection], loading: true },
    }));

    const include = filters.includeByTab?.[collection] ?? null;
    const result = await loadCollection(collection, {
      includeMine: include === null || include === 'mine',
      includeSrd: include === null || include === 'srd',
      includePublic: include === null || include === 'public',
      includeFcg: (include === null || include === 'fcg') && isPaginated,
      search: filters.search || '',
      tier: filters.tierByTab?.[collection] ?? null,
      type: filters.typeByTab?.[collection] ?? null,
      offset,
      limit,
    });

    setData(prev => ({ ...prev, [collection]: result.items }));
    setCollectionMeta(prev => ({
      ...prev,
      [collection]: { totalCount: result.totalCount, dbCount: result.dbCount, nextOffset: result.nextOffset, loading: false },
    }));
  };

  // Load all non-paginated collections (groups, scenes, adventures) — no filter/search
  const fetchAllCollections = async () => {
    await Promise.all(NON_PAGINATED_COLLECTIONS.map(col => fetchCollection(col, { filters: {} })));
  };

  // Load allItemsData (own + SRD + public, no FCG) for the Feature Library panel
  const fetchAllItemsData = async () => {
    const [advResult, envResult] = await Promise.all([
      loadCollection('adversaries', { includeSrd: true, includePublic: true, includeFcg: false, limit: 1000 }),
      loadCollection('environments', { includeSrd: true, includePublic: true, includeFcg: false, limit: 1000 }),
    ]);
    setAllItemsData({
      adversaries: advResult.items || [],
      environments: envResult.items || [],
    });
  };

  useEffect(() => {
    if (!auth) { setLoading(false); return; }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      userRef.current = currentUser;
      setUser(currentUser);
      if (currentUser) {
        try {
          // Load table_state and non-paginated collections in parallel
          const [tableStateItems] = await Promise.all([
            loadTableState(),
            fetchAllCollections(),
          ]);
          const tableState = tableStateItems[0];
          setActiveElements(tableState?.elements || []);
          setWhiteboardEmbed(tableState?.whiteboardEmbed || '');
          setRolzRoomName(tableState?.rolzRoomName || '');
          setRolzUsername(tableState?.rolzUsername || '');
          setRolzPassword(tableState?.rolzPassword || '');
          setFeatureCountdowns(tableState?.featureCountdowns || {});
          tableStateReadyRef.current = true;

          // Load the initial tab's collection
          const initialTab = routeRef.current?.tab || 'adversaries';
          if (!NON_PAGINATED_COLLECTIONS.includes(initialTab)) {
            await fetchCollection(initialTab);
          }
          // Load allItemsData for Feature Library
          fetchAllItemsData().catch(() => {});
        } catch (err) {
          console.error('Failed to load data:', err);
        }
        if (window.location.pathname === '/' || window.location.pathname === '') {
          navigate('/library/adversaries', { replace: true });
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Keep routeRef current
  useEffect(() => { routeRef.current = route; }, [route]);

  // Reload current paginated collection when tab, filters, or pagination offset changes
  const activeTab = route.tab || 'adversaries';
  useEffect(() => {
    if (!userRef.current) return;
    if (NON_PAGINATED_COLLECTIONS.includes(activeTab)) return;
    fetchCollection(activeTab).catch(err => console.error('Failed to reload collection:', err));
  }, [activeTab, libraryFilters, paginationOffset]);

  const handleSetLibraryFilters = (newFilters) => {
    setLibraryFilters(newFilters);
    setPaginationOffset(0);
    try { localStorage.setItem(LIBRARY_FILTERS_KEY, JSON.stringify(newFilters)); } catch {}
  };

  const handleSetPaginationOffset = (offset) => {
    setPaginationOffset(offset);
  };

  const saveItem = async (collectionName, item) => {
    try {
      const saved = await apiSaveItem(collectionName, item);
      if (!saved) return;
      // Update in-place in current data (optimistic)
      setData(prev => {
        const existing = prev[collectionName].findIndex(i => i.id === saved.id);
        const updated = existing >= 0
          ? prev[collectionName].map(i => i.id === saved.id ? saved : i)
          : [...prev[collectionName], saved];
        return { ...prev, [collectionName]: updated };
      });
      if (collectionName === 'adversaries' || collectionName === 'environments') {
        setAllItemsData(prev => {
          const list = prev[collectionName] || [];
          const existing = list.findIndex(i => i.id === saved.id);
          const updated = existing >= 0
            ? list.map(i => i.id === saved.id ? saved : i)
            : [...list, saved];
          return { ...prev, [collectionName]: updated };
        });
      }
    } catch (err) {
      console.error(`saveItem(${collectionName}) failed:`, err);
    }
  };

  const deleteItem = async (collectionName, id) => {
    try {
      await apiDeleteItem(collectionName, id);
      setData(prev => ({
        ...prev,
        [collectionName]: prev[collectionName].filter(i => i.id !== id),
      }));
      setCollectionMeta(prev => ({
        ...prev,
        [collectionName]: {
          ...prev[collectionName],
          totalCount: Math.max(0, (prev[collectionName]?.totalCount || 1) - 1),
          dbCount: Math.max(0, (prev[collectionName]?.dbCount || 1) - 1),
        },
      }));
      if (collectionName === 'adversaries' || collectionName === 'environments') {
        setAllItemsData(prev => ({
          ...prev,
          [collectionName]: (prev[collectionName] || []).filter(i => i.id !== id),
        }));
      }
    } catch (err) {
      console.error(`deleteItem(${collectionName}, ${id}) failed:`, err);
    }
  };

  const cloneItem = async (collectionName, item) => {
    const clone = await cloneItemToLibrary(collectionName, item, { play: false });
    // Add to local state so the clone is immediately visible in the library
    if (clone) {
      setData(prev => {
        const existing = prev[collectionName].findIndex(i => i.id === clone.id);
        const updated = existing >= 0
          ? prev[collectionName].map(i => i.id === clone.id ? clone : i)
          : [...prev[collectionName], clone];
        return { ...prev, [collectionName]: updated };
      });
    }
    return clone;
  };

  // Runtime fields that must be preserved when base data is updated in-place.
  const RUNTIME_KEYS = ['instanceId', 'elementType', 'currentHp', 'currentStress', 'conditions', 'groupName'];

  const updateActiveElementsBaseData = (predicate, newBaseData) => {
    setActiveElements(prev => prev.map(el => {
      if (!predicate(el)) return el;
      const runtime = {};
      RUNTIME_KEYS.forEach(k => { if (k in el) runtime[k] = el[k]; });
      return { ...newBaseData, ...runtime };
    }));
  };

  // Collect all DB-referenced IDs from a scene/group for batch resolution
  function collectSceneIds(scene, groupsById) {
    const adversaryIds = new Set();
    const environmentIds = new Set();

    const envEntries = scene.environments || [];
    envEntries.forEach(e => { if (typeof e === 'string') environmentIds.add(e); });

    const advRefs = scene.adversaries || [];
    advRefs.forEach(ref => { if (!ref.data && ref.adversaryId) adversaryIds.add(ref.adversaryId); });

    const groupIds = scene.groups || [];
    groupIds.forEach(groupId => {
      const group = groupsById[groupId];
      if (group) {
        (group.adversaries || []).forEach(ref => {
          if (!ref.data && ref.adversaryId) adversaryIds.add(ref.adversaryId);
        });
      }
    });

    return { adversaryIds: [...adversaryIds], environmentIds: [...environmentIds] };
  }

  // Expand a scene into table elements using pre-resolved data maps
  function expandSceneWithResolved(scene, groupsById, adversariesById, environmentsById) {
    const elements = [];
    const groupOverrides = scene.groupOverrides || [];

    (scene.environments || []).forEach(envEntry => {
      if (typeof envEntry === 'object' && envEntry.data) {
        elements.push({ id: envEntry.data.id || generateId(), ...envEntry.data, instanceId: generateId(), elementType: 'environment' });
      } else {
        const env = environmentsById[envEntry];
        if (env) elements.push({ ...env, instanceId: generateId(), elementType: 'environment' });
      }
    });

    (scene.adversaries || []).forEach(advRef => {
      const adv = advRef.data ? { id: advRef.data.id || generateId(), ...advRef.data } : adversariesById[advRef.adversaryId];
      if (adv) {
        for (let i = 0; i < (advRef.count || 1); i++) {
          elements.push({ ...adv, instanceId: generateId(), elementType: 'adversary', currentHp: adv.hp_max || 0, currentStress: 0, conditions: '' });
        }
      }
    });

    (scene.groups || []).forEach(groupId => {
      const group = groupsById[groupId];
      if (!group) return;
      (group.adversaries || []).forEach(advRef => {
        const isOverridden = groupOverrides.some(ov => ov.groupId === groupId && ov.adversaryId === advRef.adversaryId);
        if (isOverridden) return;
        const adv = advRef.data ? { id: advRef.data.id || generateId(), ...advRef.data } : adversariesById[advRef.adversaryId];
        if (adv) {
          for (let i = 0; i < (advRef.count || 1); i++) {
            elements.push({ ...adv, instanceId: generateId(), elementType: 'adversary', currentHp: adv.hp_max || 0, currentStress: 0, conditions: '', groupName: group.name });
          }
        }
      });
    });

    return elements;
  }

  const addToTable = async (item, collectionName) => {
    const newElements = [];

    if (collectionName === 'adversaries' || collectionName === 'environments') {
      let tableItem = item;
      if (!item._source || item._source === 'own') {
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
    } else if (collectionName === 'groups') {
      const advIds = (item.adversaries || []).filter(r => !r.data && r.adversaryId).map(r => r.adversaryId);
      const resolved = advIds.length ? await resolveItems({ adversaries: advIds }, { adopt: true }) : { adversaries: [] };
      const adversariesById = Object.fromEntries(resolved.adversaries.map(a => [a.id, a]));
      (item.adversaries || []).forEach(advRef => {
        const adv = advRef.data ? { id: advRef.data.id || generateId(), ...advRef.data } : adversariesById[advRef.adversaryId];
        if (adv) {
          for (let i = 0; i < (advRef.count || 1); i++) {
            newElements.push({ ...adv, instanceId: generateId(), elementType: 'adversary', currentHp: adv.hp_max || 0, currentStress: 0, conditions: '', groupName: item.name });
          }
        }
      });
    } else if (collectionName === 'scenes') {
      const groupsById = Object.fromEntries(data.groups.map(g => [g.id, g]));
      const { adversaryIds, environmentIds } = collectSceneIds(item, groupsById);
      const resolved = (adversaryIds.length || environmentIds.length)
        ? await resolveItems({ adversaries: adversaryIds, environments: environmentIds }, { adopt: true })
        : { adversaries: [], environments: [] };
      const adversariesById = Object.fromEntries(resolved.adversaries.map(a => [a.id, a]));
      const environmentsById = Object.fromEntries(resolved.environments.map(e => [e.id, e]));
      newElements.push(...expandSceneWithResolved(item, groupsById, adversariesById, environmentsById));
    } else if (collectionName === 'adventures') {
      const scenesById = Object.fromEntries(data.scenes.map(s => [s.id, s]));
      const groupsById = Object.fromEntries(data.groups.map(g => [g.id, g]));
      const allAdvIds = new Set();
      const allEnvIds = new Set();
      (item.scenes || []).forEach(sceneId => {
        const scene = scenesById[sceneId];
        if (scene) {
          const { adversaryIds, environmentIds } = collectSceneIds(scene, groupsById);
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
        if (scene) newElements.push(...expandSceneWithResolved(scene, groupsById, adversariesById, environmentsById));
      });
    }

    setActiveElements(prev => [...prev, ...newElements]);
  };

  const startScene = async (scene) => {
    const groupsById = Object.fromEntries(data.groups.map(g => [g.id, g]));
    const { adversaryIds, environmentIds } = collectSceneIds(scene, groupsById);
    const resolved = (adversaryIds.length || environmentIds.length)
      ? await resolveItems({ adversaries: adversaryIds, environments: environmentIds }, { adopt: true })
      : { adversaries: [], environments: [] };
    const adversariesById = Object.fromEntries(resolved.adversaries.map(a => [a.id, a]));
    const environmentsById = Object.fromEntries(resolved.environments.map(e => [e.id, e]));
    const newElements = expandSceneWithResolved(scene, groupsById, adversariesById, environmentsById);
    setActiveElements(newElements);
    navigate('/gm-table');
  };

  const updateActiveElement = (instanceId, updates) => {
    setActiveElements(prev => prev.map(el => el.instanceId === instanceId ? { ...el, ...updates } : el));
  };

  const removeActiveElement = (instanceId) => {
    setActiveElements(prev => prev.filter(el => el.instanceId !== instanceId));
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>;

  return (
    <div className="h-screen bg-slate-900 text-slate-200 font-sans flex flex-col overflow-hidden">
      {user && (
        <nav className="bg-slate-950 border-b border-slate-800 p-4 flex items-center justify-between shadow-md z-10">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-red-500 tracking-wider flex items-center gap-2">
              <Swords size={24} /> DAGGERHEART GM
            </h1>
            <div className="flex items-center gap-2">
              <NavBtn icon={<BookOpen />} label="Library" active={route.view === 'library'} onClick={() => navigate('/library/adversaries')} />
              <NavBtn
                icon={<LayoutDashboard />}
                label="GM Table"
                active={route.view === 'gm-table'}
                onClick={() => navigate('/gm-table')}
                pulse={tableFlash}
              />
              {(() => {
                const advCount = activeElements.filter(e => e.elementType === 'adversary').length;
                const envCount = activeElements.filter(e => e.elementType === 'environment').length;
                if (!advCount && !envCount) return null;
                const parts = [];
                if (envCount) parts.push(`${envCount} environment${envCount !== 1 ? 's' : ''}`);
                if (advCount) parts.push(`${advCount} adversar${advCount !== 1 ? 'ies' : 'y'}`);
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
            <h1 className="text-4xl font-bold text-white mb-2">Daggerheart GM Tool</h1>
            <p className="text-slate-400 mb-8 text-center max-w-md">Build adversaries, environments, and run your encounters seamlessly with integrated action tracking.</p>
            <button
              onClick={handleGoogleSignIn}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-red-900/20"
            >
              <Users size={20} /> Sign In with Google
            </button>
          </div>
        ) : route.view === 'library' ? (
          <LibraryView
            data={data}
            collectionMeta={collectionMeta}
            allItemsData={allItemsData}
            saveItem={saveItem}
            deleteItem={deleteItem}
            cloneItem={cloneItem}
            startScene={startScene}
            addToTable={addToTable}
            route={route}
            navigate={navigate}
            libraryFilters={libraryFilters}
            setLibraryFilters={handleSetLibraryFilters}
            paginationOffset={paginationOffset}
            setPaginationOffset={handleSetPaginationOffset}
            pageLimit={PAGE_LIMIT}
          />
        ) : (
          <GMTableView
            activeElements={activeElements}
            updateActiveElement={updateActiveElement}
            removeActiveElement={removeActiveElement}
            updateActiveElementsBaseData={updateActiveElementsBaseData}
            data={data}
            allItemsData={allItemsData}
            saveItem={saveItem}
            addToTable={addToTable}
            startScene={startScene}
            whiteboardEmbed={whiteboardEmbed}
            setWhiteboardEmbed={setWhiteboardEmbed}
            rolzRoomName={rolzRoomName}
            setRolzRoomName={setRolzRoomName}
            rolzUsername={rolzUsername}
            setRolzUsername={setRolzUsername}
            rolzPassword={rolzPassword}
            setRolzPassword={setRolzPassword}
            gmTab={route.gmTab}
            navigate={navigate}
            featureCountdowns={featureCountdowns}
            updateCountdown={(cardKey, featureKey, cdIdx, value) =>
              setFeatureCountdowns(prev => ({ ...prev, [`${cardKey}|${featureKey}|${cdIdx}`]: value }))
            }
          />
        )}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
