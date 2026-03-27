import { useState } from 'react';
import { FormRow } from './FormRow.jsx';
import { CollectionRefPicker } from './CollectionRefPicker.jsx';
import { ImageEditor } from './ImageEditor.jsx';

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
export function AdventureForm({ initial, value, onChange, data, onSave, onCancel, onImageSaved, onMergeAdversary, omitPublicCheckbox = false }) {
  const isControlled = value !== undefined;

  const [localData, setLocalData] = useState({
    name: initial?.name || '', imageUrl: initial?.imageUrl || '', _additionalImages: initial?._additionalImages || [],
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
      <FormRow label="Adventure Name"><input type="text" value={formData.name} onChange={e => updateField('name', e.target.value)} className="bg-dh-inset border border-dh-border rounded p-2 text-dh w-full text-lg font-bold" /></FormRow>
      <FormRow label="Images (optional)">
        <ImageEditor
          imageUrl={formData.imageUrl}
          _additionalImages={formData._additionalImages}
          onChange={({ imageUrl, _additionalImages }) => {
            if (isControlled) onChange({ ...value, imageUrl, _additionalImages });
            else setLocalData(prev => ({ ...prev, imageUrl, _additionalImages }));
          }}
          onImageSaved={onImageSaved}
          collection="adventures"
          formData={formData}
        />
      </FormRow>
      <CollectionRefPicker
        collections={ADVENTURE_COLLECTIONS}
        values={formData}
        onChange={handleRefChange}
        data={data}
        onAdversaryAdded={onMergeAdversary}
      />

      {!isControlled && (
        <div className={`flex items-center mt-6 pt-6 border-t border-dh-border ${omitPublicCheckbox ? 'justify-end' : 'justify-between'}`}>
          {!omitPublicCheckbox && (
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-dh-muted">
              <input
                type="checkbox"
                checked={!!formData.is_public}
                onChange={e => updateField('is_public', e.target.checked)}
                className="accent-blue-500"
              />
              Make Public
            </label>
          )}
          <div className="flex gap-3">
            <button onClick={onCancel} className="px-4 py-2 text-dh-muted hover:text-white">Cancel</button>
            <button onClick={() => onSave(formData)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Save Adventure</button>
          </div>
        </div>
      )}

      {isControlled && !omitPublicCheckbox && (
        <div className="mt-6 pt-4 border-t border-dh-border">
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-dh-muted">
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
