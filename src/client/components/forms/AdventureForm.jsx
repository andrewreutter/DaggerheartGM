import { useState } from 'react';
import { FormRow } from './FormRow.jsx';
import { MultiSelectRef } from './MultiSelectRef.jsx';

export function AdventureForm({ initial, data, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: initial?.name || '', imageUrl: initial?.imageUrl || '',
    scenes: initial?.scenes || [], groups: initial?.groups || [],
    environments: initial?.environments || [], adversaries: initial?.adversaries || []
  });

  return (
    <div className="space-y-4">
      <FormRow label="Adventure Name"><input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full text-lg font-bold" /></FormRow>
      <FormRow label="Image URL (optional)"><input type="url" placeholder="https://..." value={formData.imageUrl} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      <div className="grid grid-cols-2 gap-4">
        <MultiSelectRef label="Scenes" options={data.scenes} selectedIds={formData.scenes} onChange={ids => setFormData({ ...formData, scenes: ids })} />
        <MultiSelectRef label="Groups" options={data.groups} selectedIds={formData.groups} onChange={ids => setFormData({ ...formData, groups: ids })} />
        <MultiSelectRef label="Environments" options={data.environments} selectedIds={formData.environments} onChange={ids => setFormData({ ...formData, environments: ids })} />
        <MultiSelectRef label="Adversaries" options={data.adversaries} selectedIds={formData.adversaries} onChange={ids => setFormData({ ...formData, adversaries: ids })} />
      </div>
      <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-800">
        <button onClick={onCancel} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
        <button onClick={() => onSave(formData)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Save Adventure</button>
      </div>
    </div>
  );
}
