import { useState } from 'react';
import { TIERS, ENV_TYPES } from '../../lib/constants.js';
import { generateId } from '../../lib/helpers.js';
import { FormRow } from './FormRow.jsx';
import { FeaturesInput } from './FeaturesInput.jsx';

export function EnvironmentForm({ initial, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: initial?.name || '', tier: initial?.tier || 1, type: initial?.type || 'exploration',
    difficulty: initial?.difficulty || 10,
    description: initial?.description || '', imageUrl: initial?.imageUrl || '',
    features: (initial?.features || []).map(f => f.id ? f : { ...f, id: generateId() }),
    is_public: initial?.is_public || false,
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-2"><FormRow label="Name"><input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow></div>
        <FormRow label="Tier">
          <select value={formData.tier} onChange={e => setFormData({ ...formData, tier: parseInt(e.target.value) })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full">
            {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormRow>
        <FormRow label="Difficulty"><input type="number" value={formData.difficulty} onChange={e => setFormData({ ...formData, difficulty: parseInt(e.target.value) || 0 })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      </div>
      <FormRow label="Type">
        <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white">
          {ENV_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </FormRow>
      <FormRow label="Description">
        <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white h-24 resize-none" />
      </FormRow>
      <FormRow label="Image URL (optional)"><input type="url" placeholder="https://..." value={formData.imageUrl} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      <FeaturesInput features={formData.features} onChange={features => setFormData({ ...formData, features })} />
      <div className="flex justify-between items-center mt-6 pt-6 border-t border-slate-800">
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-400">
          <input
            type="checkbox"
            checked={!!formData.is_public}
            onChange={e => setFormData({ ...formData, is_public: e.target.checked })}
            className="accent-blue-500"
          />
          Make Public
        </label>
        <div className="flex gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
          <button onClick={() => onSave(formData)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Save Environment</button>
        </div>
      </div>
    </div>
  );
}
