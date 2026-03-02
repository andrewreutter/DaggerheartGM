import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ItemPickerModal, ITEM_PICKER_SINGULAR } from '../modals/ItemPickerModal.jsx';
import { resolveItems, ensureMirror } from '../../lib/api.js';

/**
 * A button-bank + unified-list widget for picking library references across
 * one or more collections. Shared by SceneForm, GroupForm, AdventureForm, and
 * styled the same as the GM Table "Add ..." buttons.
 *
 * Props:
 *   collections — [{ key, label?, isCountable? }]  which add-buttons to show
 *   values      — { [key]: string[] | {id,count}[] }  current selections per collection
 *   onChange    — (key, newValues) => void
 *   data        — app-level data object (used by ItemPickerModal for non-paginated collections)
 */
export function CollectionRefPicker({ collections, values, onChange, data }) {
  const [modalOpen, setModalOpen] = useState(null);
  const [nameMap, setNameMap] = useState({});

  // On mount, resolve names for all pre-existing referenced IDs.
  useEffect(() => {
    const toResolve = {};
    for (const { key, isCountable } of collections) {
      const vals = values[key] || [];
      const ids = vals.map(v => isCountable ? v.id : v).filter(Boolean);
      if (ids.length) toResolve[key] = ids;
    }
    if (!Object.keys(toResolve).length) return;

    resolveItems(toResolve)
      .then(resolved => {
        const map = {};
        for (const items of Object.values(resolved)) {
          if (Array.isArray(items)) {
            for (const item of items) {
              if (item.id && item.name) map[item.id] = item.name;
            }
          }
        }
        if (Object.keys(map).length) setNameMap(prev => ({ ...prev, ...map }));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getName = (id) => {
    if (nameMap[id]) return nameMap[id];
    for (const col of Object.values(data || {})) {
      if (Array.isArray(col)) {
        const item = col.find(i => i.id === id);
        if (item?.name) return item.name;
      }
    }
    return id;
  };

  const handleSelect = (item, collectionKey) => {
    const cfg = collections.find(c => c.key === collectionKey);
    const current = values[collectionKey] || [];
    setNameMap(prev => ({ ...prev, [item.id]: item.name }));
    if (item._source && !['own', 'srd', 'public'].includes(item._source)) {
      ensureMirror(collectionKey, item);
    }
    if (cfg?.isCountable) {
      if (!current.find(v => v.id === item.id)) {
        onChange(collectionKey, [...current, { id: item.id, count: 1 }]);
      }
    } else {
      if (!current.includes(item.id)) {
        onChange(collectionKey, [...current, item.id]);
      }
    }
  };

  const handleRemove = (collectionKey, id) => {
    const cfg = collections.find(c => c.key === collectionKey);
    const current = values[collectionKey] || [];
    if (cfg?.isCountable) {
      onChange(collectionKey, current.filter(v => v.id !== id));
    } else {
      onChange(collectionKey, current.filter(v => v !== id));
    }
  };

  const handleCountChange = (collectionKey, id, count) => {
    const current = values[collectionKey] || [];
    onChange(collectionKey, current.map(v => v.id === id ? { ...v, count: parseInt(count) || 1 } : v));
  };

  const allItems = useMemo(() => {
    const items = [];
    for (const { key, isCountable } of collections) {
      for (const v of (values[key] || [])) {
        const id = isCountable ? v.id : v;
        items.push({ id, collection: key, count: isCountable ? v.count : undefined, isCountable });
      }
    }
    return items;
  }, [collections, values]);

  return (
    <div className="mb-4 p-4 border border-slate-800 rounded-lg bg-slate-900/50">
      <div className="flex flex-wrap gap-2 mb-3">
        {collections.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setModalOpen(key)}
            className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 hover:border-slate-500 text-sm rounded px-3 py-2 text-slate-300 hover:text-white outline-none transition-colors"
          >
            <Plus size={14} /> Add {label || ITEM_PICKER_SINGULAR[key] || key}
          </button>
        ))}
      </div>

      {allItems.length > 0 && (
        <div className="space-y-2">
          {allItems.map(({ id, collection, count, isCountable }) => {
            const cfg = collections.find(c => c.key === collection);
            const displayName = getName(id);
            const typeLabel = cfg?.label || ITEM_PICKER_SINGULAR[collection] || collection;
            return (
              <div key={`${collection}-${id}`} className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">{typeLabel}</span>
                  <span className="text-sm text-white truncate">{displayName}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {isCountable && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500">Qty</span>
                      <input
                        type="number"
                        min="1"
                        value={count}
                        onChange={e => handleCountChange(collection, id, e.target.value)}
                        className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-center text-sm text-white"
                      />
                    </div>
                  )}
                  <button type="button" onClick={() => handleRemove(collection, id)} className="text-slate-500 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <ItemPickerModal
          collection={modalOpen}
          data={data}
          onClose={() => setModalOpen(null)}
          onSelect={(item) => handleSelect(item, modalOpen)}
        />
      )}
    </div>
  );
}
