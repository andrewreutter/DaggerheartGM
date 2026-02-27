import { Trash2 } from 'lucide-react';

export function MultiSelectRef({ label, options, selectedIds, onChange, isCountable = false }) {
  const addOption = (id) => {
    if (!id) return;
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

  return (
    <div className="mb-4 p-4 border border-slate-800 rounded-lg bg-slate-900/50">
      <label className="text-sm font-medium text-slate-300 block mb-2">{label}</label>
      <div className="flex gap-2 mb-3">
        <select className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm outline-none" onChange={(e) => { addOption(e.target.value); e.target.value = ''; }} defaultValue="">
          <option value="" disabled>Add {label}...</option>
          {options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        {(isCountable ? selectedIds : selectedIds.map(id => ({ id }))).map(item => {
          const opt = options.find(o => o.id === item.id);
          if (!opt) return null;
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
                <button type="button" onClick={() => removeOption(item.id)} className="text-slate-500 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
