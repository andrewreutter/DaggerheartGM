import { Plus, Trash2 } from 'lucide-react';
import { generateId } from '../../lib/helpers.js';
import { FEATURE_TYPES } from '../../lib/constants.js';

export function FeaturesInput({ features, onChange }) {
  const addFeature = () => onChange([...features, { id: generateId(), name: '', type: 'action', description: '' }]);
  const updateFeature = (id, key, val) => onChange(features.map(f => f.id === id ? { ...f, [key]: val } : f));
  const removeFeature = (id) => onChange(features.filter(f => f.id !== id));

  return (
    <div className="mt-6 border-t border-slate-800 pt-4">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-medium text-slate-300">Features</h4>
        <button type="button" onClick={addFeature} className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded flex items-center gap-1"><Plus size={12} /> Add</button>
      </div>
      <div className="space-y-4">
        {features.map(f => (
          <div key={f.id} className="bg-slate-950 p-3 rounded border border-slate-800 flex flex-col gap-2 relative">
            <button type="button" onClick={() => removeFeature(f.id)} className="absolute top-2 right-2 text-slate-500 hover:text-red-500"><Trash2 size={14} /></button>
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
