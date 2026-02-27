import { useState, useEffect } from 'react';
import { ShieldAlert, Map, Users, Play, BookOpen, Plus } from 'lucide-react';
import { ItemCard } from './ItemCard.jsx';
import { ItemDetailView } from './ItemDetailView.jsx';
import { RolzImportModal } from './modals/RolzImportModal.jsx';
import { FCGImportModal } from './modals/FCGImportModal.jsx';
import { AdversaryForm } from './forms/AdversaryForm.jsx';
import { EnvironmentForm } from './forms/EnvironmentForm.jsx';
import { GroupForm } from './forms/GroupForm.jsx';
import { SceneForm } from './forms/SceneForm.jsx';
import { AdventureForm } from './forms/AdventureForm.jsx';

const SINGULAR_NAMES = {
  adversaries: 'Adversary',
  environments: 'Environment',
  groups: 'Group',
  scenes: 'Scene',
  adventures: 'Adventure',
};

const TABS = [
  { id: 'adversaries', label: 'Adversaries', Icon: ShieldAlert },
  { id: 'environments', label: 'Environments', Icon: Map },
  { id: 'groups', label: 'Groups', Icon: Users },
  { id: 'scenes', label: 'Scenes', Icon: Play },
  { id: 'adventures', label: 'Adventures', Icon: BookOpen },
];

export function LibraryView({ data, saveItem, deleteItem, startScene, addToTable, route, navigate }) {
  const [showRolzImport, setShowRolzImport] = useState(false);
  const [showFCGImport, setShowFCGImport] = useState(false);

  const activeTab = route.tab || 'adversaries';
  const { itemId, action } = route;

  const isCreating = itemId === 'new';
  const isEditing = itemId && itemId !== 'new' && action === 'edit';
  const isViewing = itemId && itemId !== 'new' && !action;

  const viewingItem = isViewing ? (data[activeTab]?.find(i => i.id === itemId) || null) : null;
  const editingItem = isEditing ? (data[activeTab]?.find(i => i.id === itemId) || null) : isCreating ? {} : null;

  const handleSave = async (item) => {
    const itemToSave = { ...item };
    if (isEditing && itemId && !itemToSave.id) {
      itemToSave.id = itemId;
    }
    await saveItem(activeTab, itemToSave);
    navigate(`/library/${activeTab}`);
  };

  const handleCancelEdit = () => {
    if (isEditing && itemId) {
      navigate(`/library/${activeTab}/${itemId}`);
    } else {
      navigate(`/library/${activeTab}`);
    }
  };

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
          onImportSuccess={(collection, id) => {
            setShowRolzImport(false);
            navigate(`/library/${collection}/${id}`);
          }}
        />
      )}

      {showFCGImport && (
        <FCGImportModal
          onClose={() => setShowFCGImport(false)}
          saveItem={saveItem}
          onImportSuccess={(collection, id) => {
            setShowFCGImport(false);
            navigate(`/library/${collection}/${id}`);
          }}
        />
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-950">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white capitalize">{activeTab}</h2>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowRolzImport(true)}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 px-3 py-1.5 rounded transition-colors border border-slate-700 hover:border-amber-700"
            >
              Import Rolz Markdown
            </button>
            <button
              onClick={() => setShowFCGImport(true)}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-green-400 hover:text-green-300 px-3 py-1.5 rounded transition-colors border border-slate-700 hover:border-green-800"
            >
              Import FreshCutGrass
            </button>

            {!editingItem && !viewingItem && (
              <button
                onClick={() => navigate(`/library/${activeTab}/new`)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-medium ml-2"
              >
                <Plus size={16} /> New {SINGULAR_NAMES[activeTab]}
              </button>
            )}
          </div>
        </div>

        {editingItem !== null ? (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-xl max-w-4xl">
            {activeTab === 'adversaries' && <AdversaryForm initial={editingItem} onSave={handleSave} onCancel={handleCancelEdit} />}
            {activeTab === 'environments' && <EnvironmentForm initial={editingItem} onSave={handleSave} onCancel={handleCancelEdit} />}
            {activeTab === 'groups' && <GroupForm initial={editingItem} data={data} onSave={handleSave} onCancel={handleCancelEdit} />}
            {activeTab === 'scenes' && <SceneForm initial={editingItem} data={data} onSave={handleSave} onCancel={handleCancelEdit} />}
            {activeTab === 'adventures' && <AdventureForm initial={editingItem} data={data} onSave={handleSave} onCancel={handleCancelEdit} />}
          </div>
        ) : viewingItem ? (
          <ItemDetailView
            item={viewingItem}
            tab={activeTab}
            data={data}
            onEdit={() => navigate(`/library/${activeTab}/${itemId}/edit`)}
            onClose={() => navigate(`/library/${activeTab}`)}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data[activeTab].map(item => (
              <ItemCard
                key={item.id}
                item={item}
                tab={activeTab}
                data={data}
                onView={(item) => navigate(`/library/${activeTab}/${item.id}`)}
                onEdit={(item) => navigate(`/library/${activeTab}/${item.id}/edit`)}
                onDelete={deleteItem}
                onStartScene={startScene}
                onAddToTable={addToTable}
              />
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
