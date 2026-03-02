import { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Map, Users, Play, BookOpen, Plus, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { TIERS, ROLES, ENV_TYPES } from '../lib/constants.js';
import { ItemCard } from './ItemCard.jsx';
import { ItemDetailView } from './ItemDetailView.jsx';
import { RolzImportModal } from './modals/RolzImportModal.jsx';
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

/**
 * Renders the form card + Feature Library portal target side-by-side.
 * The callback ref pattern (ref={setLibraryPortal}) triggers a re-render once the
 * DOM element mounts, allowing createPortal inside the form to find its target.
 */
function LibraryEditingLayout({ activeTab, editingItem, data, allItemsData, handleSave, handleCancelEdit }) {
  const [libraryPortal, setLibraryPortal] = useState(null);
  const showLibrary = activeTab === 'adversaries' || activeTab === 'environments';

  return (
    <div className="flex gap-4 items-start">
      {/* Form card — scrolls independently, bounded to viewport */}
      <div className="flex-1 min-w-0 bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-xl overflow-y-auto max-h-[calc(100vh-12rem)]">
        {activeTab === 'adversaries' && (
          <AdversaryForm
            initial={editingItem}
            onSave={handleSave}
            onCancel={handleCancelEdit}
            allItems={allItemsData?.adversaries}
            featureLibraryPortal={libraryPortal}
          />
        )}
        {activeTab === 'environments' && (
          <EnvironmentForm
            initial={editingItem}
            onSave={handleSave}
            onCancel={handleCancelEdit}
            allItems={allItemsData?.environments}
            featureLibraryPortal={libraryPortal}
          />
        )}
        {activeTab === 'groups' && <GroupForm initial={editingItem} data={data} onSave={handleSave} onCancel={handleCancelEdit} />}
        {activeTab === 'scenes' && <SceneForm initial={editingItem} data={data} onSave={handleSave} onCancel={handleCancelEdit} />}
        {activeTab === 'adventures' && <AdventureForm initial={editingItem} data={data} onSave={handleSave} onCancel={handleCancelEdit} />}
      </div>

      {/* Feature Library portal target — to the right of the card, same max-h */}
      {showLibrary && (
        <div
          ref={setLibraryPortal}
          className="w-72 shrink-0 h-[calc(100vh-12rem)] overflow-hidden rounded-xl"
        />
      )}
    </div>
  );
}

export function LibraryView({ data, collectionMeta, allItemsData, saveItem, deleteItem, cloneItem, startScene, addToTable, route, navigate, libraryFilters, setLibraryFilters, paginationOffset, setPaginationOffset, pageLimit }) {
  const [showRolzImport, setShowRolzImport] = useState(false);
  // Stack of {offset, itemCount} for pages navigated forward through.
  // Enables accurate cumulative display ("12–31 of 3,405") and correct Prev navigation.
  const [prevHistory, setPrevHistory] = useState([]);
  // Local search input — debounced before updating libraryFilters.search
  const [searchInput, setSearchInput] = useState(libraryFilters?.search || '');
  const searchDebounceRef = useRef(null);
  const activeTab = route.tab || 'adversaries';

  const activeInclude = libraryFilters?.includeByTab?.[activeTab] ?? null;
  const activeTier = libraryFilters?.tierByTab?.[activeTab] ?? null;
  const activeType = libraryFilters?.typeByTab?.[activeTab] ?? null;

  useEffect(() => {
    setSearchInput(libraryFilters?.search || '');
    setPrevHistory([]);
  }, [activeTab]);

  // Reset history whenever the offset is reset to 0 (e.g. on filter change)
  useEffect(() => {
    if ((paginationOffset ?? 0) === 0) setPrevHistory([]);
  }, [paginationOffset]);
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

  const handleSearchChange = (value) => {
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setLibraryFilters({ ...libraryFilters, search: value });
    }, 500);
  };

  const selectTier = (tier) => {
    setLibraryFilters({ ...libraryFilters, tierByTab: { ...(libraryFilters?.tierByTab || {}), [activeTab]: activeTier === tier ? null : tier } });
  };

  const selectInclude = (val) => {
    setLibraryFilters({ ...libraryFilters, includeByTab: { ...(libraryFilters?.includeByTab || {}), [activeTab]: activeInclude === val ? null : val } });
  };

  const selectType = (val) => {
    setLibraryFilters({ ...libraryFilters, typeByTab: { ...(libraryFilters?.typeByTab || {}), [activeTab]: activeType === val ? null : val } });
  };

  const typeOptions = activeTab === 'adversaries' ? ROLES : activeTab === 'environments' ? ENV_TYPES : [];

  const filteredItems = items.filter(item => {
    // Instant local name filter — mirrors the server-side search before the debounce fires
    if (searchInput && SRD_FILTER_TABS.has(activeTab)) {
      if (!item.name?.toLowerCase().includes(searchInput.toLowerCase())) return false;
    }
    return true;
  });

  const paginationMeta = collectionMeta?.[activeTab];
  const paginationTotal = paginationMeta?.totalCount ?? 0;
  const paginationLimit = pageLimit ?? 20;
  // Cumulative item count across all pages seen so far in this browsing session.
  const cumulativeBase = prevHistory.reduce((s, h) => s + h.itemCount, 0);
  const paginationStart = cumulativeBase + 1;
  const paginationEnd = cumulativeBase + items.length;
  const paginationHasPrev = prevHistory.length > 0;
  const paginationHasNext = paginationEnd < paginationTotal;
  const showPagination = SRD_FILTER_TABS.has(activeTab) && !editingItem && !viewingItem && filteredItems.length > 0 && paginationTotal > paginationLimit;
  const paginationBar = (extraClass) => (
    <div className={`flex items-center justify-center gap-4 text-xs text-slate-400 ${extraClass}`}>
      <button
        disabled={!paginationHasPrev}
        onClick={() => {
          const lastEntry = prevHistory[prevHistory.length - 1];
          setPrevHistory(h => h.slice(0, -1));
          setPaginationOffset(lastEntry?.offset ?? 0);
        }}
        className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-800 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-slate-700 hover:enabled:text-slate-200 transition-colors"
      >
        <ChevronLeft size={13} /> Prev
      </button>
        <span className="text-slate-500">{paginationStart}–{paginationEnd} of {paginationTotal.toLocaleString()}</span>
      <button
        disabled={!paginationHasNext}
        onClick={() => {
          const nextPageOffset = paginationMeta?.nextOffset ?? (paginationOffset ?? 0) + paginationLimit;
          setPrevHistory(h => [...h, { offset: paginationOffset ?? 0, itemCount: items.length }]);
          setPaginationOffset(nextPageOffset);
        }}
        className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-800 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-slate-700 hover:enabled:text-slate-200 transition-colors"
      >
        Next <ChevronRight size={13} />
      </button>
    </div>
  );

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
          data={data}
          onImportSuccess={(collection, id) => {
            setShowRolzImport(false);
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
          <div className="mb-5 space-y-2">
            {/* Search bar */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder={`Search ${activeTab}…`}
                className="w-full bg-slate-800 border border-slate-700 rounded pl-7 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500 transition-colors"
              />
            </div>

            {/* Source + tier + type filters */}
            <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
              <span className="text-slate-500 font-medium uppercase tracking-wider">Include</span>
              <button
                onClick={() => setLibraryFilters({ ...libraryFilters, includeByTab: { ...(libraryFilters?.includeByTab || {}), [activeTab]: null } })}
                className={`px-2 py-0.5 rounded font-medium border transition-colors ${
                  activeInclude === null
                    ? 'bg-cyan-800 border-cyan-500 text-cyan-100'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                }`}
              >
                All
              </button>
              {[
                { value: 'mine', label: 'Mine' },
                { value: 'srd', label: 'SRD' },
                { value: 'public', label: 'Public' },
                { value: 'fcg', label: 'FCG' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => selectInclude(value)}
                  className={`px-2 py-0.5 rounded font-medium border transition-colors ${
                    activeInclude === value
                      ? 'bg-cyan-800 border-cyan-500 text-cyan-100'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
              <span className="text-slate-700 select-none">|</span>
              <span className="text-slate-500 font-medium uppercase tracking-wider">Tier</span>
              <button
                onClick={() => setLibraryFilters({ ...libraryFilters, tierByTab: { ...(libraryFilters?.tierByTab || {}), [activeTab]: null } })}
                className={`px-2 py-0.5 rounded font-medium border transition-colors ${
                  activeTier === null
                    ? 'bg-amber-700 border-amber-500 text-amber-100'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                }`}
              >
                All
              </button>
              {TIERS.map(t => (
                <button
                  key={t}
                  onClick={() => selectTier(t)}
                  className={`px-2 py-0.5 rounded font-medium border transition-colors ${
                    activeTier === t
                      ? 'bg-amber-700 border-amber-500 text-amber-100'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                  }`}
                >
                  {t}
                </button>
              ))}
              <span className="text-slate-700 select-none">|</span>
              <span className="text-slate-500 font-medium uppercase tracking-wider">Type</span>
              <button
                onClick={() => setLibraryFilters({ ...libraryFilters, typeByTab: { ...(libraryFilters?.typeByTab || {}), [activeTab]: null } })}
                className={`px-2 py-0.5 rounded font-medium border transition-colors ${
                  activeType === null
                    ? 'bg-red-800 border-red-500 text-red-100'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                }`}
              >
                All
              </button>
              {typeOptions.map(val => (
                <button
                  key={val}
                  onClick={() => selectType(val)}
                  className={`px-2 py-0.5 rounded font-medium border transition-colors capitalize ${
                    activeType === val
                      ? 'bg-red-800 border-red-500 text-red-100'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        )}

        {editingItem !== null ? (
          <LibraryEditingLayout
            activeTab={activeTab}
            editingItem={editingItem}
            data={data}
            allItemsData={allItemsData}
            handleSave={handleSave}
            handleCancelEdit={handleCancelEdit}
          />
        ) : viewingItem ? (
          <ItemDetailView
            item={viewingItem}
            tab={activeTab}
            data={data}
            allItemsData={allItemsData}
            onEdit={viewingItem._source && viewingItem._source !== 'own' ? null : () => navigate(`/library/${activeTab}/${itemId}/edit`)}
            onDelete={viewingItem._source && viewingItem._source !== 'own' ? null : () => deleteItem(activeTab, itemId)}
            onClone={() => handleClone(viewingItem)}
            onClose={() => navigate(`/library/${activeTab}`)}
            onSavePublic={(is_public) => saveItem(activeTab, { ...viewingItem, is_public })}
            onSaveElement={(activeTab === 'scenes' || activeTab === 'groups') && (!viewingItem._source || viewingItem._source === 'own') ? handleSaveElement : null}
          />
        ) : (
          <>
            {showPagination && paginationBar('mb-4')}

            <div className="flex flex-wrap gap-2">
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
                  {paginationMeta?.loading
                    ? <span className="animate-pulse">Loading {activeTab}…</span>
                    : items.length === 0
                      ? `No ${activeTab} found. Click "New" to create one.`
                      : 'No items match the selected filters.'
                  }
                </div>
              )}
            </div>

            {showPagination && paginationBar('mt-6')}
          </>
        )}
      </div>
    </div>
  );
}
