import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { signInWithPopup, signOut, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';
import { Swords, BookOpen, LayoutDashboard, Users, ChevronDown, LogOut, Upload, Download } from 'lucide-react';

import { auth, loadData, saveItem as apiSaveItem, deleteItem as apiDeleteItem } from './lib/api.js';
import { generateId } from './lib/helpers.js';
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

  const [activeElements, setActiveElements] = useState([]);
  const [highlightedInstance, setHighlightedInstance] = useState(null);
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
    try {
      await signOut(auth);
      navigate('/');
    } catch (err) {
      console.error('Sign-Out Error:', err);
    }
  };

  const handleExport = () => {
    setUserMenuOpen(false);
    const jsonStr = JSON.stringify(data, null, 2);
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

  useEffect(() => {
    if (!auth) { setLoading(false); return; }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const fetched = await loadData(currentUser);
          setData(fetched);
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

  const saveItem = async (collectionName, item) => {
    try {
      const saved = await apiSaveItem(collectionName, item);
      if (!saved) return;
      setData(prev => {
        const existing = prev[collectionName].findIndex(i => i.id === saved.id);
        const updated = existing >= 0
          ? prev[collectionName].map(i => i.id === saved.id ? saved : i)
          : [...prev[collectionName], saved];
        return { ...prev, [collectionName]: updated };
      });
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
    } catch (err) {
      console.error(`deleteItem(${collectionName}, ${id}) failed:`, err);
    }
  };

  const triggerHighlight = (instanceId) => {
    setHighlightedInstance(instanceId);
    setTimeout(() => setHighlightedInstance(null), 1500);
  };

  const addToTable = (item, collectionName) => {
    const newElements = [];

    const pushAdversary = (adv, groupName) => {
      newElements.push({ ...adv, instanceId: generateId(), elementType: 'adversary', currentHp: adv.hp_max || 0, currentStress: 0, conditions: '', ...(groupName ? { groupName } : {}) });
    };

    const pushEnvironment = (env) => {
      newElements.push({ ...env, instanceId: generateId(), elementType: 'environment' });
    };

    const expandScene = (scene) => {
      scene.environments?.forEach(envId => {
        const env = data.environments.find(e => e.id === envId);
        if (env) pushEnvironment(env);
      });
      scene.adversaries?.forEach(advRef => {
        const adv = data.adversaries.find(a => a.id === advRef.adversaryId);
        if (adv) for (let i = 0; i < advRef.count; i++) pushAdversary(adv);
      });
      scene.groups?.forEach(groupId => {
        const group = data.groups.find(g => g.id === groupId);
        if (group) {
          group.adversaries?.forEach(advRef => {
            const adv = data.adversaries.find(a => a.id === advRef.adversaryId);
            if (adv) for (let i = 0; i < advRef.count; i++) pushAdversary(adv, group.name);
          });
        }
      });
    };

    switch (collectionName) {
      case 'adversaries':
        pushAdversary(item);
        break;
      case 'environments':
        pushEnvironment(item);
        break;
      case 'groups':
        item.adversaries?.forEach(advRef => {
          const adv = data.adversaries.find(a => a.id === advRef.adversaryId);
          if (adv) for (let i = 0; i < advRef.count; i++) pushAdversary(adv, item.name);
        });
        break;
      case 'scenes':
        expandScene(item);
        break;
      case 'adventures':
        item.scenes?.forEach(sceneId => {
          const scene = data.scenes.find(s => s.id === sceneId);
          if (scene) expandScene(scene);
        });
        break;
      default:
        break;
    }

    setActiveElements(prev => [...prev, ...newElements]);
  };

  const startScene = (scene) => {
    const newElements = [];

    scene.environments?.forEach(envId => {
      const env = data.environments.find(e => e.id === envId);
      if (env) newElements.push({ ...env, instanceId: generateId(), elementType: 'environment' });
    });

    scene.adversaries?.forEach(advRef => {
      const adv = data.adversaries.find(a => a.id === advRef.adversaryId);
      if (adv) {
        for (let i = 0; i < advRef.count; i++) {
          newElements.push({ ...adv, instanceId: generateId(), elementType: 'adversary', currentHp: adv.hp_max, currentStress: 0, conditions: '' });
        }
      }
    });

    scene.groups?.forEach(groupId => {
      const group = data.groups.find(g => g.id === groupId);
      if (group) {
        group.adversaries?.forEach(advRef => {
          const adv = data.adversaries.find(a => a.id === advRef.adversaryId);
          if (adv) {
            for (let i = 0; i < advRef.count; i++) {
              newElements.push({ ...adv, instanceId: generateId(), elementType: 'adversary', currentHp: adv.hp_max, currentStress: 0, conditions: '', groupName: group.name });
            }
          }
        });
      }
    });

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
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans flex flex-col">
      {user && (
        <nav className="bg-slate-950 border-b border-slate-800 p-4 flex items-center justify-between shadow-md z-10">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-red-500 tracking-wider flex items-center gap-2">
              <Swords size={24} /> DAGGERHEART GM
            </h1>
            <div className="flex gap-2">
              <NavBtn icon={<BookOpen />} label="Library" active={route.view === 'library'} onClick={() => navigate('/library/adversaries')} />
              <NavBtn
                icon={<LayoutDashboard />}
                label="GM Table"
                active={route.view === 'gm-table'}
                onClick={() => navigate('/gm-table')}
                badge={(() => {
                  const envCount = activeElements.filter(e => e.elementType === 'environment').length;
                  const advTypeCount = new Set(activeElements.filter(e => e.elementType === 'adversary').map(e => e.id)).size;
                  const total = envCount + advTypeCount;
                  return total > 0 ? `(${total})` : null;
                })()}
                pulse={tableFlash}
              />
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
          <LibraryView data={data} saveItem={saveItem} deleteItem={deleteItem} startScene={startScene} addToTable={addToTable} route={route} navigate={navigate} />
        ) : (
          <GMTableView
            activeElements={activeElements}
            highlightedInstance={highlightedInstance}
            triggerHighlight={triggerHighlight}
            updateActiveElement={updateActiveElement}
            removeActiveElement={removeActiveElement}
            data={data}
            addToTable={addToTable}
            startScene={startScene}
          />
        )}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
