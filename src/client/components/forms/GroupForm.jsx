import { useState } from 'react';
import { FormRow } from './FormRow.jsx';
import { MultiSelectRef } from './MultiSelectRef.jsx';

export function GroupForm({ initial, data, onSave, onCancel }) {
  // Separate owned copies (advRef.data) from references (advRef.adversaryId)
  const initialOwned = initial?.adversaries?.filter(a => a.data) || [];
  const initialRefs = initial?.adversaries?.filter(a => a.adversaryId) || [];

  const [formData, setFormData] = useState({
    name: initial?.name || '', description: initial?.description || '',
    imageUrl: initial?.imageUrl || '',
    adversaries: initialRefs.map(a => ({ id: a.adversaryId, count: a.count })),
    is_public: initial?.is_public || false,
  });
  // Owned adversary copies are preserved as-is (not editable via form selectors).
  const [ownedAdversaries] = useState(initialOwned);

  const handleSave = () => {
    const refs = formData.adversaries.map(a => ({ adversaryId: a.id, count: a.count }));
    onSave({ ...formData, adversaries: [...refs, ...ownedAdversaries] });
  };

  return (
    <div className="space-y-4">
      <FormRow label="Group Name"><input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      <FormRow label="Description"><textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white h-20 resize-none w-full" /></FormRow>
      <FormRow label="Image URL (optional)"><input type="url" placeholder="https://..." value={formData.imageUrl} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      <MultiSelectRef label="Adversaries (Library References)" options={data.adversaries} selectedIds={formData.adversaries} onChange={advs => setFormData({ ...formData, adversaries: advs })} isCountable={true} />
      {ownedAdversaries.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Local Copies</div>
          <div className="flex flex-wrap gap-2">
            {ownedAdversaries.map((ref, i) => (
              <span key={i} className="text-xs bg-amber-900/30 border border-amber-700/50 text-amber-300 px-2 py-1 rounded-full">
                {ref.data?.name || 'Unknown'}{ref.count > 1 ? ` ×${ref.count}` : ''}
                <span className="ml-1 text-amber-500/60 text-[10px]">copy</span>
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1">Local copies can be edited from the Group detail view.</p>
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
          <button onClick={handleSave} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Save Group</button>
        </div>
      </div>
    </div>
  );
}
