import { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { ItemPickerModal, ITEM_PICKER_SINGULAR } from '../modals/ItemPickerModal.jsx';

/**
 * A multi-select widget for picking library references (by ID).
 *
 * When `collection` is provided, the native <select> dropdown is replaced with an
 * "Add <Singular>" button that opens ItemPickerModal — giving users full search,
 * source/tier/type filters, and infinite scroll. Selected items are tracked in a
 * local nameCache so their names display correctly even when not present in `options`.
 *
 * When `collection` is omitted, it falls back to the original native <select> behaviour.
 *
 * Props:
 *   label        — section heading
 *   options      — { id, name }[] available items (used for display + fallback picker)
 *   selectedIds  — string[] or { id, count }[] (when isCountable)
 *   onChange     — called with the updated selectedIds array
 *   isCountable  — when true, each entry is { id, count } and a quantity input is shown
   *   collection   — optional; enables the modal picker ('adversaries' | 'environments' | 'scenes' | ...)
 */
export function MultiSelectRef({ label, options, selectedIds, onChange, isCountable = false, collection }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  // Accumulates names for items chosen via the modal that may not be in `options`.
  const [nameCache, setNameCache] = useState({});

  const addById = (id, name) => {
    if (!id) return;
    if (name) setNameCache(prev => ({ ...prev, [id]: name }));
    if (isCountable) {
      if (!selectedIds.find(item => item.id === id)) onChange([...selectedIds, { id, count: 1 }]);
    } else {
      if (!selectedIds.includes(id)) onChange([...selectedIds, id]);
    }
  };

  const removeOption = (id) => {
    if (isCountable) onChange(selectedIds.filter(item => item.id !== id));
    else onChange(selectedIds.filter(itemId => itemId !== id));
  };

  const updateCount = (id, count) => {
    onChange(selectedIds.map(item => item.id === id ? { ...item, count: parseInt(count) || 1 } : item));
  };

  const getDisplayName = (id) =>
    nameCache[id] || options.find(o => o.id === id)?.name || id;

  const singular = collection ? (ITEM_PICKER_SINGULAR[collection] || collection) : null;

  return (
    <div className="mb-4 p-4 border border-slate-800 rounded-lg bg-slate-900/50">
      <label className="text-sm font-medium text-slate-300 block mb-2">{label}</label>

      <div className="flex gap-2 mb-3">
        {collection ? (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white rounded transition-colors"
          >
            <Plus size={14} />
            Add {singular}…
          </button>
        ) : (
          <select
            className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm outline-none"
            onChange={(e) => { addById(e.target.value); e.target.value = ''; }}
            defaultValue=""
          >
            <option value="" disabled>Add {label}...</option>
            {options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
          </select>
        )}
      </div>

      <div className="space-y-2">
        {(isCountable ? selectedIds : selectedIds.map(id => ({ id }))).map(item => {
          const displayName = getDisplayName(item.id);
          return (
            <div key={item.id} className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800">
              <span className="text-sm text-white">{displayName}</span>
              <div className="flex items-center gap-3">
                {isCountable && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500">Qty</span>
                    <input
                      type="number"
                      min="1"
                      value={item.count}
                      onChange={e => updateCount(item.id, e.target.value)}
                      className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-center text-sm text-white"
                    />
                  </div>
                )}
                <button type="button" onClick={() => removeOption(item.id)} className="text-slate-500 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {pickerOpen && collection && (
        <ItemPickerModal
          collection={collection}
          data={{ [collection]: options }}
          onClose={() => setPickerOpen(false)}
          onSelect={(item) => addById(item.id, item.name)}
        />
      )}
    </div>
  );
}
