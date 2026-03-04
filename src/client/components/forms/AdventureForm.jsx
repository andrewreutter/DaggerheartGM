import { useState } from 'react';
import { FormRow } from './FormRow.jsx';
import { CollectionRefPicker } from './CollectionRefPicker.jsx';
import { ImageGenerator } from '../ImageGenerator.jsx';

const ADVENTURE_COLLECTIONS = [
  { key: 'scenes', label: 'Scene' },
  { key: 'environments', label: 'Environment' },
  { key: 'adversaries', label: 'Adversary' },
];

/**
 * Controlled mode: pass `value` (full formData) + `onChange(newFormData)`.
 * Uncontrolled mode: pass `initial`, `onSave`, `onCancel` (legacy path).
 * Save/Cancel buttons are only rendered in uncontrolled mode.
 */
export function AdventureForm({ initial, value, onChange, data, onSave, onCancel, onImageSaved, onMergeAdversary }) {
  const isControlled = value !== undefined;

  const [localData, setLocalData] = useState({
    name: initial?.name || '', imageUrl: initial?.imageUrl || '',
    scenes: initial?.scenes || [],
    environments: initial?.environments || [], adversaries: initial?.adversaries || [],
    is_public: initial?.is_public || false,
  });

  const formData = isControlled ? value : localData;

  const handleRefChange = (key, newValues) => {
    if (isControlled) {
      onChange({ ...value, [key]: newValues });
    } else {
      setLocalData(prev => ({ ...prev, [key]: newValues }));
    }
  };

  const updateField = (field, val) => {
    if (isControlled) {
      onChange({ ...value, [field]: val });
    } else {
      setLocalData(prev => ({ ...prev, [field]: val }));
    }
  };

  return (
    <div className="space-y-4">
      <FormRow label="Adventure Name"><input type="text" value={formData.name} onChange={e => updateField('name', e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full text-lg font-bold" /></FormRow>
      <FormRow label="Image URL (optional)"><input type="url" placeholder="https://..." value={formData.imageUrl} onChange={e => updateField('imageUrl', e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      <ImageGenerator formData={formData} collection="adventures" onImageGenerated={url => { updateField('imageUrl', url); onImageSaved?.(url); }} />
      <CollectionRefPicker
        collections={ADVENTURE_COLLECTIONS}
        values={formData}
        onChange={handleRefChange}
        data={data}
        onAdversaryAdded={onMergeAdversary}
      />

      {!isControlled && (
        <div className="flex justify-between items-center mt-6 pt-6 border-t border-slate-800">
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-400">
            <input
              type="checkbox"
              checked={!!formData.is_public}
              onChange={e => updateField('is_public', e.target.checked)}
              className="accent-blue-500"
            />
            Make Public
          </label>
          <div className="flex gap-3">
            <button onClick={onCancel} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
            <button onClick={() => onSave(formData)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Save Adventure</button>
          </div>
        </div>
      )}

      {isControlled && (
        <div className="mt-6 pt-4 border-t border-slate-800">
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-400">
            <input
              type="checkbox"
              checked={!!formData.is_public}
              onChange={e => updateField('is_public', e.target.checked)}
              className="accent-blue-500"
            />
            Make Public
          </label>
        </div>
      )}
    </div>
  );
}
