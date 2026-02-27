import { useState } from 'react';
import { FormRow } from './FormRow.jsx';
import { MultiSelectRef } from './MultiSelectRef.jsx';

export function SceneForm({ initial, data, onSave, onCancel }) {
  // Separate owned copies from ID references for environments and adversaries.
  const initialOwnedEnvs = (initial?.environments || []).filter(e => typeof e === 'object' && e.data);
  const initialRefEnvs = (initial?.environments || []).filter(e => typeof e === 'string');
  const initialOwnedAdvs = (initial?.adversaries || []).filter(a => a.data);
  const initialRefAdvs = (initial?.adversaries || []).filter(a => a.adversaryId);

  const [formData, setFormData] = useState({
    name: initial?.name || '', description: initial?.description || '',
    imageUrl: initial?.imageUrl || '',
    environments: initialRefEnvs,
    groups: initial?.groups || [],
    adversaries: initialRefAdvs.map(a => ({ id: a.adversaryId, count: a.count })),
    is_public: initial?.is_public || false,
  });
  // Owned copies and group overrides are preserved as-is through saves.
  const [ownedEnvironments] = useState(initialOwnedEnvs);
  const [ownedAdversaries] = useState(initialOwnedAdvs);
  const groupOverrides = initial?.groupOverrides || [];

  const hasOwnedContent = ownedEnvironments.length > 0 || ownedAdversaries.length > 0;

  const handleSave = () => {
    const envRefs = formData.environments;
    const advRefs = formData.adversaries.map(a => ({ adversaryId: a.id, count: a.count }));
    onSave({
      ...formData,
      environments: [...envRefs, ...ownedEnvironments],
      adversaries: [...advRefs, ...ownedAdversaries],
      groupOverrides,
    });
  };

  return (
    <div className="space-y-4">
      <FormRow label="Scene Name"><input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      <FormRow label="Description"><textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white h-20 resize-none w-full" /></FormRow>
      <FormRow label="Image URL (optional)"><input type="url" placeholder="https://..." value={formData.imageUrl} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      <div className="grid grid-cols-2 gap-4">
        <MultiSelectRef label="Environments (Library References)" options={data.environments} selectedIds={formData.environments} onChange={envs => setFormData({ ...formData, environments: envs })} />
        <MultiSelectRef label="Groups" options={data.groups} selectedIds={formData.groups} onChange={grps => setFormData({ ...formData, groups: grps })} />
      </div>
      <MultiSelectRef label="Individual Adversaries (Library References)" options={data.adversaries} selectedIds={formData.adversaries} onChange={advs => setFormData({ ...formData, adversaries: advs })} isCountable={true} />
      {hasOwnedContent && (
        <div>
          <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Local Copies</div>
          <div className="flex flex-wrap gap-2">
            {ownedEnvironments.map((entry, i) => (
              <span key={`env-${i}`} className="text-xs bg-amber-900/30 border border-amber-700/50 text-amber-300 px-2 py-1 rounded-full">
                {entry.data?.name || 'Unknown environment'} <span className="ml-1 text-amber-500/60 text-[10px]">env copy</span>
              </span>
            ))}
            {ownedAdversaries.map((ref, i) => (
              <span key={`adv-${i}`} className="text-xs bg-amber-900/30 border border-amber-700/50 text-amber-300 px-2 py-1 rounded-full">
                {ref.data?.name || 'Unknown adversary'}{ref.count > 1 ? ` ×${ref.count}` : ''} <span className="ml-1 text-amber-500/60 text-[10px]">copy</span>
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1">Local copies can be edited from the Scene detail view.</p>
        </div>
      )}
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
          <button onClick={handleSave} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Save Scene</button>
        </div>
      </div>
    </div>
  );
}
