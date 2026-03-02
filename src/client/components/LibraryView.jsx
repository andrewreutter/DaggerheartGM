import { useState, useEffect } from 'react';
import { ShieldAlert, Map, Users, Play, BookOpen, Plus } from 'lucide-react';
import { TIERS, ROLES, ENV_TYPES } from '../lib/constants.js';
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

const SRD_FILTER_TABS = new Set(['adversaries', 'environments']);

export function LibraryView({ data, saveItem, deleteItem, cloneItem, startScene, addToTable, route, navigate, libraryFilters, setLibraryFilters }) {
  const [showRolzImport, setShowRolzImport] = useState(false);
  const [showFCGImport, setShowFCGImport] = useState(false);
  const [tierFilter, setTierFilter] = useState(new Set());
  const [typeFilter, setTypeFilter] = useState(new Set());

  const activeTab = route.tab || 'adversaries';

  useEffect(() => {
    setTierFilter(new Set());
    setTypeFilter(new Set());
  }, [activeTab]);
  const { itemId, action } = route;

  const isCreating = itemId === 'new';
  const isEditing = itemId && itemId !== 'new' && action === 'edit';
  const isViewing = itemId && itemId !== 'new' && !action;

  const items = data[activeTab] || [];
  const viewingItem = isViewing ? (items.find(i => i.id === itemId) || null) : null;
  const editingItem = isEditing ? (items.find(i => i.id === itemId) || null) : isCreating ? {} : null;

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

  const handleClone = async (item) => {
    const cloned = await cloneItem(activeTab, item);
    navigate(`/library/${activeTab}/${cloned.id}`);
  };

  /**
   * Applies an edited copy of an element back into the parent scene/group data structure,
   * replacing the reference at the given index with an inline owned copy.
   */
  const applyEditedCopyToParent = (element, editedData, parentItem, parentTab) => {
    if (parentTab === 'groups') {
      const newAdversaries = (parentItem.adversaries || []).map((ref, idx) => {
        if (idx !== element._originRefIndex) return ref;
        return { data: editedData, count: ref.count || 1 };
      });
      return { ...parentItem, adversaries: newAdversaries };
    }

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

      if (element._origin === 'group') {
        // Create a scene-level override: add owned copy to scene.adversaries, suppress from group expansion.
        const newAdversaries = [...(parentItem.adversaries || []), { data: editedData, count: element._count || 1 }];
        const newOverrides = [
          ...(parentItem.groupOverrides || []),
          { groupId: element._originGroupId, adversaryId: element._originAdvId },
        ];
        return { ...parentItem, adversaries: newAdversaries, groupOverrides: newOverrides };
      }
    }

    return parentItem;
  };

  const handleSaveElement = async (element, editedData, mode) => {
    if (mode === 'original') {
      await saveItem(element._collection, editedData);
    } else {
      const updatedParent = applyEditedCopyToParent(element, editedData, viewingItem, activeTab);
      await saveItem(activeTab, updatedParent);
    }
  };

  const toggleFilter = (key) => {
    setLibraryFilters({ ...libraryFilters, [key]: !libraryFilters[key] });
  };

  const toggleTier = (tier) => {
    setTierFilter(prev => {
      const next = new Set(prev);
      next.has(tier) ? next.delete(tier) : next.add(tier);
      return next;
    });
  };

  const toggleType = (val) => {
    setTypeFilter(prev => {
      const next = new Set(prev);
      next.has(val) ? next.delete(val) : next.add(val);
      return next;
    });
  };

  const typeOptions = activeTab === 'adversaries' ? ROLES : activeTab === 'environments' ? ENV_TYPES : [];

  const filteredItems = items.filter(item => {
    if (tierFilter.size > 0 && !tierFilter.has(item.tier)) return false;
    if (typeFilter.size > 0) {
      const typeVal = activeTab === 'adversaries' ? item.role : item.type;
      if (!typeFilter.has(typeVal)) return false;
    }
    return true;
  });

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar Tabs */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-4 font-semibold text-slate-300 uppercase tracking-wider text-xs">Database</div>
        {TABS.map(tab => {
          const tabItems = data[tab.id] || [];
          const ownCount = tabItems.filter(i => !i._source || i._source === 'own').length;
          const totalCount = tabItems.length;
          const countLabel = totalCount > ownCount ? `${ownCount}+${totalCount - ownCount}` : String(ownCount);
          return (
            <button
              key={tab.id}
              onClick={() => navigate(`/library/${tab.id}`)}
              className={`flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${
                activeTab === tab.id ? 'bg-slate-800 text-red-400 border-r-2 border-red-500' : 'text-slate-400 hover:bg-slate-800/50'
              }`}
            >
              <tab.Icon size={18} /> {tab.label} ({countLabel})
            </button>
          );
        })}
      </div>

      {showRolzImport && (
        <RolzImportModal
          onClose={() => setShowRolzImport(false)}
          saveItem={saveItem}
          data={data}
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
          data={data}
          onImportSuccess={(collection, id) => {
            setShowFCGImport(false);
            navigate(`/library/${collection}/${id}`);
          }}
        />
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-950">
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

        {SRD_FILTER_TABS.has(activeTab) && !editingItem && !viewingItem && (
          <div className="flex items-center gap-3 mb-5 text-xs text-slate-400 flex-wrap">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!libraryFilters?.includeSrd}
                onChange={() => toggleFilter('includeSrd')}
                className="accent-violet-500"
              />
              <span className="text-violet-400 font-medium">Include SRD</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!libraryFilters?.includePublic}
                onChange={() => toggleFilter('includePublic')}
                className="accent-blue-500"
              />
              <span className="text-blue-400 font-medium">Include Public</span>
            </label>
            <span className="text-slate-700 select-none">|</span>
            <span className="text-slate-500 font-medium uppercase tracking-wider">Tier</span>
            {TIERS.map(t => (
              <button
                key={t}
                onClick={() => toggleTier(t)}
                className={`px-2 py-0.5 rounded font-medium border transition-colors ${
                  tierFilter.has(t)
                    ? 'bg-amber-700 border-amber-500 text-amber-100'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                }`}
              >
                {t}
              </button>
            ))}
            <span className="text-slate-700 select-none">|</span>
            <span className="text-slate-500 font-medium uppercase tracking-wider">Type</span>
            {typeOptions.map(val => (
              <button
                key={val}
                onClick={() => toggleType(val)}
                className={`px-2 py-0.5 rounded font-medium border transition-colors capitalize ${
                  typeFilter.has(val)
                    ? 'bg-red-800 border-red-500 text-red-100'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                }`}
              >
                {val}
              </button>
            ))}
            {(tierFilter.size > 0 || typeFilter.size > 0) && (
              <button
                onClick={() => { setTierFilter(new Set()); setTypeFilter(new Set()); }}
                className="text-slate-500 hover:text-slate-300 underline transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        )}

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
            onEdit={viewingItem._source && viewingItem._source !== 'own' ? null : () => navigate(`/library/${activeTab}/${itemId}/edit`)}
            onDelete={viewingItem._source && viewingItem._source !== 'own' ? null : () => deleteItem(activeTab, itemId)}
            onClone={() => handleClone(viewingItem)}
            onClose={() => navigate(`/library/${activeTab}`)}
            onSavePublic={(is_public) => saveItem(activeTab, { ...viewingItem, is_public })}
            onSaveElement={(activeTab === 'scenes' || activeTab === 'groups') && (!viewingItem._source || viewingItem._source === 'own') ? handleSaveElement : null}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map(item => (
              <ItemCard
                key={`${item._source || 'own'}-${item.id}`}
                item={item}
                tab={activeTab}
                data={data}
                onView={(item) => navigate(`/library/${activeTab}/${item.id}`)}
                onEdit={item._source && item._source !== 'own' ? null : (item) => navigate(`/library/${activeTab}/${item.id}/edit`)}
                onDelete={item._source && item._source !== 'own' ? null : deleteItem}
                onClone={() => handleClone(item)}
                onStartScene={startScene}
                onAddToTable={addToTable}
              />
            ))}
            {filteredItems.length === 0 && (
              <div className="col-span-full text-center p-8 text-slate-500 border border-dashed border-slate-800 rounded-lg">
                {items.length === 0 ? `No ${activeTab} found. Click "New" to create one.` : 'No items match the selected filters.'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
