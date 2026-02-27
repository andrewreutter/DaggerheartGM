import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';
import { 
  Users, Map, ShieldAlert, Swords, BookOpen, LayoutDashboard, 
  Plus, Trash2, Edit, Play, Search, Heart, Zap, AlertCircle, X
} from 'lucide-react';

// --- Firebase Initialization ---
const { firebaseConfig } = await fetch('/api/config').then(r => r.json());
let app, auth;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} catch(e) {
  console.error('Firebase initialization failed:', e);
}

// --- Constants & Enums ---
const ROLES = ['bruiser', 'skirmisher', 'minion', 'leader', 'artillery', 'horde', 'solo'];
const ENV_TYPES = ['traversal', 'exploration', 'social', 'event'];
const FEATURE_TYPES = ['action', 'reaction', 'passive'];
const TIERS = [1, 2, 3, 4];
const DAMAGE_TYPES = ['Phy', 'Mag', 'Dir'];

// --- Helper Functions ---
const generateId = () => crypto.randomUUID();

const parseFeatureCategory = (feature) => {
  if (!feature.description) return 'Actions';
  const desc = feature.description;
  if (/spend.*fear/i.test(desc) || /mark.*fear/i.test(desc)) return 'Fear Actions';
  if (feature.type === 'reaction') return 'Reactions';
  if (feature.type === 'passive') return 'Passives';
  return 'Actions';
};

// --- Main Application Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('home'); // home, gm-table, library

  // Data State
  const [data, setData] = useState({
    adversaries: [],
    environments: [],
    groups: [],
    scenes: [],
    adventures: []
  });

  // GM Table State
  const [activeElements, setActiveElements] = useState([]);
  const [highlightedInstance, setHighlightedInstance] = useState(null);

  // --- Google Sign-In ---
  const handleGoogleSignIn = async () => {
    if (!auth) { console.error('Firebase auth not initialized — check .env credentials'); return; }
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Google Sign-In Error:', err);
    }
  };

  // --- Data Loading ---
  const loadData = async (currentUser) => {
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/data', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fetched = await res.json();
      setData(fetched);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  // --- Auth ---
  useEffect(() => {
    if (!auth) { setLoading(false); return; }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await loadData(currentUser);
        if (view === 'home') setView('library');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Database Mutations ---
  const saveItem = async (collectionName, item) => {
    const currentUser = auth?.currentUser;
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/data/${collectionName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(item),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const saved = await res.json();
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
    const currentUser = auth?.currentUser;
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/data/${collectionName}/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(prev => ({
        ...prev,
        [collectionName]: prev[collectionName].filter(i => i.id !== id),
      }));
    } catch (err) {
      console.error(`deleteItem(${collectionName}, ${id}) failed:`, err);
    }
  };

  // --- GM Table Logic ---
  const triggerHighlight = (instanceId) => {
    setHighlightedInstance(instanceId);
    setTimeout(() => setHighlightedInstance(null), 1500);
  };

  const addToTable = (element, type) => {
    const instance = {
      ...element,
      instanceId: generateId(),
      elementType: type,
      currentHp: element.hp_max || 0,
      currentStress: 0,
      conditions: ''
    };
    setActiveElements(prev => [...prev, instance]);
  };

  const startScene = (scene) => {
    const newElements = [];
    
    // Add Environments
    scene.environments?.forEach(envId => {
      const env = data.environments.find(e => e.id === envId);
      if (env) newElements.push({ ...env, instanceId: generateId(), elementType: 'environment' });
    });

    // Add Direct Adversaries
    scene.adversaries?.forEach(advRef => {
      const adv = data.adversaries.find(a => a.id === advRef.adversaryId);
      if (adv) {
        for (let i = 0; i < advRef.count; i++) {
          newElements.push({ ...adv, instanceId: generateId(), elementType: 'adversary', currentHp: adv.hp_max, currentStress: 0, conditions: '' });
        }
      }
    });

    // Add Groups
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
    setView('gm-table');
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
      {/* Top Navigation */}
      {user && (
        <nav className="bg-slate-950 border-b border-slate-800 p-4 flex items-center justify-between shadow-md z-10">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-red-500 tracking-wider flex items-center gap-2">
              <Swords size={24} /> DAGGERHEART GM
            </h1>
            <div className="flex gap-2">
              <NavBtn icon={<BookOpen />} label="Library" active={view === 'library'} onClick={() => setView('library')} />
              <NavBtn icon={<LayoutDashboard />} label="GM Table" active={view === 'gm-table'} onClick={() => setView('gm-table')} />
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <div className="flex flex-col items-end">
              <span className="text-green-500 font-medium">
                {user.displayName || user.email || 'Signed In'}
              </span>
              <span className="text-[10px] opacity-60 font-mono">
                {user.email}
              </span>
            </div>
          </div>
        </nav>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {!user || view === 'home' ? (
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
        ) : view === 'library' ? (
          <LibraryView data={data} saveItem={saveItem} deleteItem={deleteItem} startScene={startScene} />
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

// --- Sub-Components ---

function NavBtn({ icon, label, active, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
      }`}
    >
      {React.cloneElement(icon, { size: 18 })}
      {label}
    </button>
  );
}

// --- LIBRARY VIEW ---
function LibraryView({ data, saveItem, deleteItem, startScene }) {
  const [activeTab, setActiveTab] = useState('adversaries');
  const [editingItem, setEditingItem] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [importStatus, setImportStatus] = useState('');

  const singularNames = { adversaries: 'Adversary', environments: 'Environment', groups: 'Group', scenes: 'Scene', adventures: 'Adventure' };

  const tabs = [
    { id: 'adversaries', label: 'Adversaries', icon: <ShieldAlert size={18} /> },
    { id: 'environments', label: 'Environments', icon: <Map size={18} /> },
    { id: 'groups', label: 'Groups', icon: <Users size={18} /> },
    { id: 'scenes', label: 'Scenes', icon: <Play size={18} /> },
    { id: 'adventures', label: 'Adventures', icon: <BookOpen size={18} /> },
  ];

  const handleSave = async (item) => {
    const itemToSave = { ...item };
    if (editingItem && editingItem.id && !itemToSave.id) {
      itemToSave.id = editingItem.id;
    }
    await saveItem(activeTab, itemToSave);
    setEditingItem(null);
  };

  const handleExport = () => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.href = url;
    downloadAnchorNode.download = "daggerheart_db.json";
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    document.body.removeChild(downloadAnchorNode);
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
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

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar Tabs */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-4 font-semibold text-slate-300 uppercase tracking-wider text-xs">Database</div>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setEditingItem(null); setViewingItem(null); }}
            className={`flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${
              activeTab === tab.id ? 'bg-slate-800 text-red-400 border-r-2 border-red-500' : 'text-slate-400 hover:bg-slate-800/50'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-950">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white capitalize">{activeTab}</h2>
          
          <div className="flex items-center gap-3">
            {importStatus && <span className="text-xs text-green-400 font-medium">{importStatus}</span>}
            <button onClick={handleExport} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded transition-colors">
              Export JSON
            </button>
            <label className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded transition-colors cursor-pointer">
              Import JSON
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>

            {!editingItem && !viewingItem && (
              <button 
                onClick={() => { setEditingItem({}); setViewingItem(null); }} 
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-medium ml-2"
              >
                <Plus size={16} /> New {singularNames[activeTab]}
              </button>
            )}
          </div>
        </div>

        {editingItem ? (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-xl max-w-4xl">
            {activeTab === 'adversaries' && <AdversaryForm initial={editingItem} onSave={handleSave} onCancel={() => setEditingItem(null)} />}
            {activeTab === 'environments' && <EnvironmentForm initial={editingItem} onSave={handleSave} onCancel={() => setEditingItem(null)} />}
            {activeTab === 'groups' && <GroupForm initial={editingItem} data={data} onSave={handleSave} onCancel={() => setEditingItem(null)} />}
            {activeTab === 'scenes' && <SceneForm initial={editingItem} data={data} onSave={handleSave} onCancel={() => setEditingItem(null)} />}
            {activeTab === 'adventures' && <AdventureForm initial={editingItem} data={data} onSave={handleSave} onCancel={() => setEditingItem(null)} />}
          </div>
        ) : viewingItem ? (
          <ItemDetailView 
            item={viewingItem} 
            tab={activeTab} 
            onEdit={() => { setEditingItem(viewingItem); setViewingItem(null); }} 
            onClose={() => setViewingItem(null)} 
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data[activeTab].map(item => (
              <div key={item.id} onClick={() => setViewingItem(item)} className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-700 hover:bg-slate-800/50 cursor-pointer transition-colors flex flex-col group">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-white group-hover:text-red-400 transition-colors">{item.name}</h3>
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    {activeTab === 'scenes' && (
                      <button onClick={() => startScene(item)} className="text-green-500 hover:text-green-400" title="Start Scene">
                        <Play size={16} />
                      </button>
                    )}
                    <button onClick={() => { setEditingItem(item); setViewingItem(null); }} className="text-slate-400 hover:text-blue-400"><Edit size={16} /></button>
                    <button onClick={() => deleteItem(activeTab, item.id)} className="text-slate-400 hover:text-red-400"><Trash2 size={16} /></button>
                  </div>
                </div>
                <div className="text-sm text-slate-400 flex-1">
                  {activeTab === 'adversaries' && `Tier ${item.tier || 0} ${item.role}`}
                  {activeTab === 'environments' && `Tier ${item.tier || 0} ${item.type}`}
                  {activeTab === 'groups' && `${item.adversaries?.length || 0} adversary types`}
                  {activeTab === 'scenes' && `${(item.environments?.length || 0) + (item.groups?.length || 0) + (item.adversaries?.length || 0)} elements`}
                  {activeTab === 'adventures' && `${item.scenes?.length || 0} scenes`}
                  
                  {/* FCG Preview Info */}
                  {item.motive && <p className="mt-2 text-xs italic text-slate-300">"{item.motive}"</p>}
                  {item.description && <p className="mt-1 text-xs opacity-80 line-clamp-2">{item.description}</p>}
                </div>
              </div>
            ))}
            {data[activeTab].length === 0 && (
              <div className="col-span-full text-center p-8 text-slate-500 border border-dashed border-slate-800 rounded-lg">
                No {activeTab} found. Click "New" to create one.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ItemDetailView({ item, tab, onEdit, onClose }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-xl max-w-3xl relative">
      <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={20}/></button>
      
      <div className="mb-6 pr-8">
        <h2 className="text-3xl font-bold text-white mb-1">{item.name}</h2>
        <div className="text-slate-400 uppercase tracking-wider text-sm font-medium mb-2">
          {tab === 'adversaries' && `Tier ${item.tier || 0} ${item.role}`}
          {tab === 'environments' && `Tier ${item.tier || 0} ${item.type} Environment`}
          {tab === 'groups' && `Group`}
          {tab === 'scenes' && `Scene`}
          {tab === 'adventures' && `Adventure`}
        </div>
        {item.description && (
          <div className="text-slate-300 italic whitespace-pre-wrap text-sm">{item.description}</div>
        )}
      </div>

      {tab === 'adversaries' && (item.motive || (item.experiences && item.experiences.length > 0)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {item.motive && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1 mb-2">Motives & Tactics</h3>
              <p className="text-sm text-slate-300">{item.motive}</p>
            </div>
          )}
          {item.experiences && item.experiences.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1 mb-2">Experiences</h3>
              <div className="flex flex-wrap gap-2">
                {item.experiences.map(exp => (
                  <span key={exp.id} className="text-sm bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 rounded">
                    {exp.name} <strong className="text-red-400">+{exp.modifier}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'adversaries' && (
        <div className="grid grid-cols-4 gap-4 mb-6 bg-slate-950 p-4 rounded-lg border border-slate-800">
          <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">Difficulty</span><span className="text-xl text-white">{item.difficulty || '-'}</span></div>
          <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">HP</span><span className="text-xl text-white">{item.hp_max || '-'}</span></div>
          <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">Thresholds</span><span className="text-xl text-white">{item.hp_thresholds?.major || '-'}/{item.hp_thresholds?.severe || '-'}</span></div>
          <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">Stress</span><span className="text-xl text-white">{item.stress_max || '-'}</span></div>
        </div>
      )}

      {/* Attacks Display */}
      {item.attack && item.attack.name && (
        <div className="mb-6 space-y-3">
          <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Attack</h3>
          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <span className="font-bold text-red-400">{item.attack.name}:</span>
            <span className="text-slate-300"> {item.attack.modifier >= 0 ? '+' : ''}{item.attack.modifier} {item.attack.range} | {item.attack.damage} {item.attack.trait?.toLowerCase()}</span>
          </div>
        </div>
      )}

      {/* Features Display */}
      {item.features && item.features.length > 0 && (
        <div className="mb-6 space-y-3">
          <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Features</h3>
          {item.features.map(f => (
            <div key={f.id} className="bg-slate-950 p-3 rounded border border-slate-800">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-red-400">{f.name}</span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded uppercase tracking-wider">{f.type}</span>
              </div>
              <p className="text-sm text-slate-300">{f.description}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-4 border-t border-slate-800">
        <button onClick={onEdit} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium flex items-center gap-2">
          <Edit size={16} /> Edit {item.name}
        </button>
      </div>
    </div>
  );
}

// --- GM TABLE VIEW ---
function GMTableView({ activeElements, highlightedInstance, triggerHighlight, updateActiveElement, removeActiveElement, data, addToTable, startScene }) {
  
  // Consolidate features from all active elements
  const consolidatedMenu = useMemo(() => {
    const menu = { 'Fear Actions': [], 'Reactions': [], 'Actions': [], 'Passives': [] };
    
    activeElements.forEach(element => {
      // Automatically add the element's attack as an Action on the board
      if (element.attack && element.attack.name) {
        menu['Actions'].push({
          id: `${element.instanceId}-attack`,
          name: element.attack.name,
          type: 'action',
          description: `${element.attack.modifier >= 0 ? '+' : ''}${element.attack.modifier} ${element.attack.range} | ${element.attack.damage} ${element.attack.trait?.toLowerCase()}`,
          sourceName: element.name,
          sourceInstanceId: element.instanceId
        });
      }

      element.features?.forEach(feature => {
        const category = parseFeatureCategory(feature);
        menu[category].push({
          ...feature,
          sourceName: element.name,
          sourceInstanceId: element.instanceId
        });
      });
    });
    return menu;
  }, [activeElements]);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Column: Consolidated Actions */}
      <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col overflow-y-auto">
        <div className="p-4 bg-slate-950 border-b border-slate-800 sticky top-0 z-10">
          <h2 className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Zap size={18} className="text-yellow-500" /> Actions Board
          </h2>
        </div>
        
        <div className="p-4 space-y-6">
          {Object.entries(consolidatedMenu).map(([category, features]) => {
            if (features.length === 0) return null;
            return (
              <div key={category}>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-1">{category}</h3>
                <div className="space-y-2">
                  {features.map((feature, idx) => (
                    <button
                      key={`${feature.id}-${idx}`}
                      onClick={() => triggerHighlight(feature.sourceInstanceId)}
                      className="w-full text-left bg-slate-800/50 hover:bg-slate-800 p-3 rounded border border-slate-700 hover:border-slate-500 transition-all group"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-slate-200 group-hover:text-white text-sm">{feature.name}</span>
                        <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">{feature.sourceName}</span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2">{feature.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {activeElements.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">
              No active elements.<br/>Start a scene to populate actions.
            </div>
          )}
        </div>
      </div>

      {/* Right Column: The Table */}
      <div className="flex-1 bg-slate-950 p-6 overflow-y-auto relative">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">The Table</h2>
          <div className="flex gap-2">
            <select 
              className="bg-slate-900 border border-slate-700 text-sm rounded px-3 py-2 text-white outline-none"
              onChange={(e) => {
                if(e.target.value) {
                  const scene = data.scenes.find(s => s.id === e.target.value);
                  if(scene) startScene(scene);
                  e.target.value = "";
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>Start Scene...</option>
              {data.scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          {activeElements.map(element => (
            <div 
              key={element.instanceId} 
              className={`bg-slate-900 border rounded-xl p-5 shadow-lg transition-all duration-300 relative ${
                highlightedInstance === element.instanceId ? 'ring-4 ring-yellow-500 border-yellow-500 scale-[1.02] z-10' : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <button onClick={() => removeActiveElement(element.instanceId)} className="absolute top-4 right-4 text-slate-500 hover:text-red-500">
                <Trash2 size={16} />
              </button>

              <div className="flex items-center gap-2 mb-1 pr-8">
                <h3 className="text-xl font-bold text-white">{element.name}</h3>
                {element.groupName && <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">{element.groupName}</span>}
              </div>
              
              <div className="text-sm text-slate-400 mb-2 capitalize">
                {element.elementType === 'adversary' ? `Tier ${element.tier || 0} ${element.role}` : `Tier ${element.tier || 0} ${element.type} Environment`}
              </div>

              {element.description && (
                <div className="text-sm italic text-slate-300 mb-4 whitespace-pre-wrap">{element.description}</div>
              )}

              {element.elementType === 'adversary' && (element.motive || (element.experiences && element.experiences.length > 0)) && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {element.motive && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1 mb-2">Motives & Tactics</h4>
                      <p className="text-sm text-slate-300">{element.motive}</p>
                    </div>
                  )}
                  {element.experiences && element.experiences.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1 mb-2">Experiences</h4>
                      <div className="flex flex-wrap gap-2">
                        {element.experiences.map(exp => (
                          <span key={exp.id} className="text-xs bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 rounded">
                            {exp.name} <strong className="text-red-400">+{exp.modifier}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {element.elementType === 'adversary' && (
                <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-950 p-3 rounded-lg border border-slate-800">
                  {/* Combat Stats */}
                  <div className="col-span-2 flex gap-6 text-sm font-medium border-b border-slate-800 pb-3 mb-2">
                    <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">Difficulty</span><span className="text-lg">{element.difficulty || '-'}</span></div>
                    <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">HP</span><span className="text-lg">{element.hp_max || '-'}</span></div>
                    <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">Thresholds</span><span className="text-lg">{element.hp_thresholds?.major || '-'}/{element.hp_thresholds?.severe || '-'}</span></div>
                  </div>

                  {/* HP Tracker */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1"><Heart size={12} className="text-red-500"/> HP</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        value={element.currentHp} 
                        onChange={(e) => updateActiveElement(element.instanceId, { currentHp: parseInt(e.target.value) || 0 })}
                        className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-center font-bold text-white outline-none focus:border-red-500"
                      />
                      <span className="text-slate-500 text-sm">/ {element.hp_max}</span>
                    </div>
                  </div>

                  {/* Stress Tracker */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1"><AlertCircle size={12} className="text-purple-500"/> Stress</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        value={element.currentStress} 
                        onChange={(e) => updateActiveElement(element.instanceId, { currentStress: parseInt(e.target.value) || 0 })}
                        className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-center font-bold text-white outline-none focus:border-purple-500"
                      />
                      <span className="text-slate-500 text-sm">/ {element.stress_max}</span>
                    </div>
                  </div>

                  {/* Conditions */}
                  <div className="col-span-2 mt-2">
                    <input 
                      type="text" 
                      placeholder="Conditions (e.g., Vulnerable, Restrained)..." 
                      value={element.conditions || ''}
                      onChange={(e) => updateActiveElement(element.instanceId, { conditions: e.target.value })}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Element Attack listed on card */}
              {element.attack && element.attack.name && (
                <div className="space-y-2 mb-4">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1">Attack</h4>
                  <div className="text-sm">
                    <span className="font-bold text-slate-200">{element.attack.name}:</span>
                    <span className="text-slate-300"> {element.attack.modifier >= 0 ? '+' : ''}{element.attack.modifier} {element.attack.range} | {element.attack.damage} {element.attack.trait?.toLowerCase()}</span>
                  </div>
                </div>
              )}

              {/* Element Features listed on card */}
              {element.features && element.features.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1">Features</h4>
                  {element.features.map(feat => (
                    <div key={feat.id} className="text-sm">
                      <span className="font-bold text-slate-200 mr-2">{feat.name}</span>
                      <span className="text-slate-400">{feat.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {activeElements.length === 0 && (
            <div className="col-span-full h-64 border-2 border-dashed border-slate-800 rounded-xl flex items-center justify-center text-slate-500">
              The table is empty. Select a scene above to start.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- FORMS ---

function FormRow({ label, children, className="" }) {
  return (
    <div className={`flex flex-col gap-1 mb-4 ${className}`}>
      <label className="text-sm font-medium text-slate-400">{label}</label>
      {children}
    </div>
  );
}

function ExperiencesInput({ experiences, onChange }) {
  const addExperience = () => onChange([...experiences, { id: generateId(), name: '', modifier: 1 }]);
  const updateExperience = (id, key, val) => onChange(experiences.map(e => e.id === id ? { ...e, [key]: val } : e));
  const removeExperience = (id) => onChange(experiences.filter(e => e.id !== id));

  return (
    <div className="mt-6 border-t border-slate-800 pt-4">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-medium text-slate-300">Experiences</h4>
        <button type="button" onClick={addExperience} className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded flex items-center gap-1"><Plus size={12}/> Add</button>
      </div>
      <div className="space-y-3">
        {experiences.map(exp => (
          <div key={exp.id} className="flex items-center gap-2 relative bg-slate-950 p-2 rounded border border-slate-800 pr-8">
            <input type="text" placeholder="Experience Name" value={exp.name} onChange={e => updateExperience(exp.id, 'name', e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white" />
            <span className="text-slate-400 text-sm font-bold">+</span>
            <input type="number" min="1" placeholder="2" value={exp.modifier} onChange={e => updateExperience(exp.id, 'modifier', parseInt(e.target.value)||1)} className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white text-center" />
            <button type="button" onClick={() => removeExperience(exp.id)} className="absolute right-2 text-slate-500 hover:text-red-500"><Trash2 size={14}/></button>
          </div>
        ))}
        {experiences.length === 0 && <p className="text-xs text-slate-500 italic">No experiences added.</p>}
      </div>
    </div>
  );
}

function FeaturesInput({ features, onChange }) {
  const addFeature = () => onChange([...features, { id: generateId(), name: '', type: 'action', description: '' }]);
  const updateFeature = (id, key, val) => onChange(features.map(f => f.id === id ? { ...f, [key]: val } : f));
  const removeFeature = (id) => onChange(features.filter(f => f.id !== id));

  return (
    <div className="mt-6 border-t border-slate-800 pt-4">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-medium text-slate-300">Features</h4>
        <button type="button" onClick={addFeature} className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded flex items-center gap-1"><Plus size={12}/> Add</button>
      </div>
      <div className="space-y-4">
        {features.map(f => (
          <div key={f.id} className="bg-slate-950 p-3 rounded border border-slate-800 flex flex-col gap-2 relative">
            <button type="button" onClick={() => removeFeature(f.id)} className="absolute top-2 right-2 text-slate-500 hover:text-red-500"><Trash2 size={14}/></button>
            <div className="grid grid-cols-2 gap-2 pr-6">
              <input type="text" placeholder="Feature Name" value={f.name} onChange={e => updateFeature(f.id, 'name', e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white" />
              <select value={f.type} onChange={e => updateFeature(f.id, 'type', e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white">
                {FEATURE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <textarea placeholder="Description (e.g. 'Spend a Fear to...')" value={f.description} onChange={e => updateFeature(f.id, 'description', e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white h-16 resize-none" />
          </div>
        ))}
        {features.length === 0 && <p className="text-xs text-slate-500 italic">No features added.</p>}
      </div>
    </div>
  );
}

function AdversaryForm({ initial, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: initial?.name || '', tier: initial?.tier || 1, role: initial?.role || 'bruiser',
    motive: initial?.motive || '', description: initial?.description || '',
    difficulty: initial?.difficulty || 10, hp_max: initial?.hp_max || 6,
    hp_thresholds: initial?.hp_thresholds || { major: 3, severe: 5 }, stress_max: initial?.stress_max || 4,
    attack: initial?.attack || initial?.attacks?.[0] || { name: '', range: 'Melee', modifier: 0, trait: 'Phy', damage: '' },
    experiences: initial?.experiences || [], features: initial?.features || []
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormRow label="Name"><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" /></FormRow>
        <FormRow label="Role">
          <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white">
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </FormRow>
      </div>
      
      <FormRow label="Motives & Tactics"><input type="text" placeholder="e.g. To add to their bone collection" value={formData.motive} onChange={e => setFormData({...formData, motive: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      <FormRow label="Description (Flavor)"><textarea placeholder="Description or flavor text..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white h-20 resize-none w-full" /></FormRow>

      <div className="grid grid-cols-3 gap-4 mt-6">
        <FormRow label="Tier">
          <select value={formData.tier} onChange={e => setFormData({...formData, tier: parseInt(e.target.value)})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full">
            {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormRow>
        <FormRow label="Difficulty"><input type="number" value={formData.difficulty} onChange={e => setFormData({...formData, difficulty: parseInt(e.target.value)})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" /></FormRow>
        <FormRow label="Stress"><input type="number" value={formData.stress_max} onChange={e => setFormData({...formData, stress_max: parseInt(e.target.value)})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" /></FormRow>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <FormRow label="HP"><input type="number" value={formData.hp_max} onChange={e => setFormData({...formData, hp_max: parseInt(e.target.value)})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" /></FormRow>
        <FormRow label="Major Threshold"><input type="number" value={formData.hp_thresholds.major} onChange={e => setFormData({...formData, hp_thresholds: {...formData.hp_thresholds, major: parseInt(e.target.value)}})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" /></FormRow>
        <FormRow label="Severe Threshold"><input type="number" value={formData.hp_thresholds.severe} onChange={e => setFormData({...formData, hp_thresholds: {...formData.hp_thresholds, severe: parseInt(e.target.value)}})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" /></FormRow>
      </div>
      
      <div className="mt-6 border-t border-slate-800 pt-4">
        <h4 className="font-medium text-slate-300 mb-4">Attack</h4>
        <div className="bg-slate-950 p-3 rounded border border-slate-800 flex flex-col gap-3">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-5"><input type="text" placeholder="Attack Name" value={formData.attack.name} onChange={e => setFormData({...formData, attack: {...formData.attack, name: e.target.value}})} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white" /></div>
            <div className="col-span-4">
              <select value={formData.attack.range} onChange={e => setFormData({...formData, attack: {...formData.attack, range: e.target.value}})} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white">
                <option value="Melee">Melee</option>
                <option value="Ranged">Ranged</option>
              </select>
            </div>
            <div className="col-span-3">
              <select value={formData.attack.trait} onChange={e => setFormData({...formData, attack: {...formData.attack, trait: e.target.value}})} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white">
                {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-4 flex items-center gap-2">
              <span className="text-sm text-slate-400">Mod:</span>
              <input type="number" placeholder="+0" value={formData.attack.modifier} onChange={e => setFormData({...formData, attack: {...formData.attack, modifier: parseInt(e.target.value)||0}})} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white" />
            </div>
            <div className="col-span-8 flex items-center gap-2">
              <span className="text-sm text-slate-400">Dmg:</span>
              <input type="text" placeholder="e.g. d8+2" value={formData.attack.damage} onChange={e => setFormData({...formData, attack: {...formData.attack, damage: e.target.value}})} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white" />
            </div>
          </div>
        </div>
      </div>

      <ExperiencesInput experiences={formData.experiences} onChange={experiences => setFormData({...formData, experiences})} />
      <FeaturesInput features={formData.features} onChange={features => setFormData({...formData, features})} />

      <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-800">
        <button onClick={onCancel} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
        <button onClick={() => onSave(formData)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Save Adversary</button>
      </div>
    </div>
  );
}

function EnvironmentForm({ initial, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: initial?.name || '', tier: initial?.tier || 1, type: initial?.type || 'exploration',
    description: initial?.description || '', features: initial?.features || []
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2"><FormRow label="Name"><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow></div>
        <FormRow label="Tier">
          <select value={formData.tier} onChange={e => setFormData({...formData, tier: parseInt(e.target.value)})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full">
            {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormRow>
      </div>
      <FormRow label="Type">
        <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white">
          {ENV_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </FormRow>
      <FormRow label="Description">
        <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white h-24 resize-none" />
      </FormRow>
      <FeaturesInput features={formData.features} onChange={features => setFormData({...formData, features})} />
      <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-800">
        <button onClick={onCancel} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
        <button onClick={() => onSave(formData)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Save Environment</button>
      </div>
    </div>
  );
}

// Reusable component for selecting referenced elements (Adversaries, Groups, Environments)
function MultiSelectRef({ label, options, selectedIds, onChange, isCountable = false }) {
  const addOption = (id) => {
    if(!id) return;
    if (isCountable) {
      if(!selectedIds.find(item => item.id === id)) onChange([...selectedIds, { id, count: 1 }]);
    } else {
      if(!selectedIds.includes(id)) onChange([...selectedIds, id]);
    }
  };

  const removeOption = (id) => {
    if(isCountable) onChange(selectedIds.filter(item => item.id !== id));
    else onChange(selectedIds.filter(itemId => itemId !== id));
  };

  const updateCount = (id, count) => {
    onChange(selectedIds.map(item => item.id === id ? { ...item, count: parseInt(count)||1 } : item));
  };

  return (
    <div className="mb-4 p-4 border border-slate-800 rounded-lg bg-slate-900/50">
      <label className="text-sm font-medium text-slate-300 block mb-2">{label}</label>
      <div className="flex gap-2 mb-3">
        <select className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm outline-none" onChange={(e) => { addOption(e.target.value); e.target.value=""; }} defaultValue="">
          <option value="" disabled>Add {label}...</option>
          {options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        {(isCountable ? selectedIds : selectedIds.map(id => ({id}))).map(item => {
          const opt = options.find(o => o.id === item.id);
          if(!opt) return null;
          return (
            <div key={item.id} className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800">
              <span className="text-sm text-white">{opt.name}</span>
              <div className="flex items-center gap-3">
                {isCountable && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500">Qty</span>
                    <input type="number" min="1" value={item.count} onChange={e => updateCount(item.id, e.target.value)} className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-center text-sm text-white" />
                  </div>
                )}
                <button type="button" onClick={() => removeOption(item.id)} className="text-slate-500 hover:text-red-500"><Trash2 size={14}/></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GroupForm({ initial, data, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: initial?.name || '', description: initial?.description || '', 
    adversaries: initial?.adversaries?.map(a => ({ id: a.adversaryId, count: a.count })) || []
  });

  return (
    <div className="space-y-4">
      <FormRow label="Group Name"><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      <FormRow label="Description"><textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white h-20 resize-none w-full" /></FormRow>
      <MultiSelectRef label="Adversaries" options={data.adversaries} selectedIds={formData.adversaries} onChange={advs => setFormData({...formData, adversaries: advs})} isCountable={true} />
      <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-800">
        <button onClick={onCancel} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
        <button onClick={() => onSave({...formData, adversaries: formData.adversaries.map(a => ({adversaryId: a.id, count: a.count}))})} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Save Group</button>
      </div>
    </div>
  );
}

function SceneForm({ initial, data, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: initial?.name || '', description: initial?.description || '', 
    environments: initial?.environments || [], groups: initial?.groups || [],
    adversaries: initial?.adversaries?.map(a => ({ id: a.adversaryId, count: a.count })) || []
  });

  return (
    <div className="space-y-4">
      <FormRow label="Scene Name"><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      <FormRow label="Description"><textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white h-20 resize-none w-full" /></FormRow>
      <div className="grid grid-cols-2 gap-4">
        <MultiSelectRef label="Environments" options={data.environments} selectedIds={formData.environments} onChange={envs => setFormData({...formData, environments: envs})} />
        <MultiSelectRef label="Groups" options={data.groups} selectedIds={formData.groups} onChange={grps => setFormData({...formData, groups: grps})} />
      </div>
      <MultiSelectRef label="Individual Adversaries" options={data.adversaries} selectedIds={formData.adversaries} onChange={advs => setFormData({...formData, adversaries: advs})} isCountable={true} />
      <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-800">
        <button onClick={onCancel} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
        <button onClick={() => onSave({...formData, adversaries: formData.adversaries.map(a => ({adversaryId: a.id, count: a.count}))})} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Save Scene</button>
      </div>
    </div>
  );
}

function AdventureForm({ initial, data, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: initial?.name || '', scenes: initial?.scenes || [], groups: initial?.groups || [],
    environments: initial?.environments || [], adversaries: initial?.adversaries || []
  });

  return (
    <div className="space-y-4">
      <FormRow label="Adventure Name"><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full text-lg font-bold" /></FormRow>
      <div className="grid grid-cols-2 gap-4">
        <MultiSelectRef label="Scenes" options={data.scenes} selectedIds={formData.scenes} onChange={ids => setFormData({...formData, scenes: ids})} />
        <MultiSelectRef label="Groups" options={data.groups} selectedIds={formData.groups} onChange={ids => setFormData({...formData, groups: ids})} />
        <MultiSelectRef label="Environments" options={data.environments} selectedIds={formData.environments} onChange={ids => setFormData({...formData, environments: ids})} />
        <MultiSelectRef label="Adversaries" options={data.adversaries} selectedIds={formData.adversaries} onChange={ids => setFormData({...formData, adversaries: ids})} />
      </div>
      <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-800">
        <button onClick={onCancel} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
        <button onClick={() => onSave(formData)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Save Adventure</button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);