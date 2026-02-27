import { useState } from 'react';
import { FormRow } from './FormRow.jsx';
import { MultiSelectRef } from './MultiSelectRef.jsx';

export function SceneForm({ initial, data, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: initial?.name || '', description: initial?.description || '',
    imageUrl: initial?.imageUrl || '',
    environments: initial?.environments || [], groups: initial?.groups || [],
    adversaries: initial?.adversaries?.map(a => ({ id: a.adversaryId, count: a.count })) || []
  });

  return (
    <div className="space-y-4">
      <FormRow label="Scene Name"><input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      <FormRow label="Description"><textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white h-20 resize-none w-full" /></FormRow>
      <FormRow label="Image URL (optional)"><input type="url" placeholder="https://..." value={formData.imageUrl} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      <div className="grid grid-cols-2 gap-4">
        <MultiSelectRef label="Environments" options={data.environments} selectedIds={formData.environments} onChange={envs => setFormData({ ...formData, environments: envs })} />
        <MultiSelectRef label="Groups" options={data.groups} selectedIds={formData.groups} onChange={grps => setFormData({ ...formData, groups: grps })} />
      </div>
      <MultiSelectRef label="Individual Adversaries" options={data.adversaries} selectedIds={formData.adversaries} onChange={advs => setFormData({ ...formData, adversaries: advs })} isCountable={true} />
      <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-800">
        <button onClick={onCancel} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
        <button onClick={() => onSave({ ...formData, adversaries: formData.adversaries.map(a => ({ adversaryId: a.id, count: a.count })) })} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Save Scene</button>
      </div>
    </div>
  );
}
