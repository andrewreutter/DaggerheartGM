import { useState } from 'react';
import { FormRow } from './FormRow.jsx';
import { CollectionRefPicker } from './CollectionRefPicker.jsx';

const SCENE_COLLECTIONS = [
  { key: 'adversaries', label: 'Adversary', isCountable: true },
  { key: 'environments', label: 'Environment' },
  { key: 'scenes', label: 'Scene' },
];

/**
 * Checks whether adding `selectedSceneIds` to a scene with `currentSceneId`
 * would create a circular reference. Walks the graph of scene.scenes references
 * using the `allScenes` list and returns true if a cycle is detected.
 */
function wouldCreateCycle(currentSceneId, selectedSceneIds, allScenes) {
  if (!currentSceneId) return false;
  const scenesById = Object.fromEntries((allScenes || []).map(s => [s.id, s]));

  // For each selected scene, check if currentSceneId is reachable from it.
  const isReachable = (fromId, targetId, visited = new Set()) => {
    if (fromId === targetId) return true;
    if (visited.has(fromId)) return false;
    visited.add(fromId);
    const scene = scenesById[fromId];
    if (!scene) return false;
    return (scene.scenes || []).some(childId => isReachable(childId, targetId, visited));
  };

  return selectedSceneIds.some(id => isReachable(id, currentSceneId));
}

/**
 * Controlled mode: pass `value` (full assembled scene data) + `onChange(newFormData)`.
 * `value.adversaries` = [{adversaryId, count}, ...ownedCopies]
 * `value.environments` = [string, ...{data} objects]
 * In controlled mode CollectionRefPicker sees only ID refs; owned copies are read-only.
 *
 * Uncontrolled mode: pass `initial`, `onSave`, `onCancel` (legacy path).
 */
export function SceneForm({ initial, value, onChange, data, onSave, onCancel }) {
  const isControlled = value !== undefined;

  // --- Uncontrolled state (legacy path) ---
  const initialOwnedEnvs = (initial?.environments || []).filter(e => typeof e === 'object' && e.data);
  const initialRefEnvs = (initial?.environments || []).filter(e => typeof e === 'string');
  const initialOwnedAdvs = (initial?.adversaries || []).filter(a => a.data);
  const initialRefAdvs = (initial?.adversaries || []).filter(a => a.adversaryId);

  const [localData, setLocalData] = useState({
    name: initial?.name || '', description: initial?.description || '',
    imageUrl: initial?.imageUrl || '',
    environments: initialRefEnvs,
    scenes: initial?.scenes || [],
    adversaries: initialRefAdvs.map(a => ({ id: a.adversaryId, count: a.count })),
    is_public: initial?.is_public || false,
  });
  const [ownedEnvironments] = useState(initialOwnedEnvs);
  const [ownedAdversaries] = useState(initialOwnedAdvs);
  const [cycleError, setCycleError] = useState('');

  // --- Controlled helpers ---
  const controlledRefAdvs = isControlled
    ? (value.adversaries || []).filter(a => a.adversaryId).map(a => ({ id: a.adversaryId, count: a.count }))
    : null;
  const controlledOwnedAdvs = isControlled
    ? (value.adversaries || []).filter(a => a.data)
    : null;
  const controlledRefEnvs = isControlled
    ? (value.environments || []).filter(e => typeof e === 'string')
    : null;
  const controlledOwnedEnvs = isControlled
    ? (value.environments || []).filter(e => typeof e === 'object' && e.data)
    : null;

  // The values object passed to CollectionRefPicker.
  const pickerValues = isControlled
    ? { adversaries: controlledRefAdvs, environments: controlledRefEnvs, scenes: value.scenes || [] }
    : { adversaries: localData.adversaries, environments: localData.environments, scenes: localData.scenes };

  const fd = isControlled ? value : localData;

  const handlePickerChange = (key, newValues) => {
    if (isControlled) {
      if (key === 'adversaries') {
        const dbRefs = newValues.map(r => ({ adversaryId: r.id, count: r.count }));
        onChange({ ...value, adversaries: [...dbRefs, ...controlledOwnedAdvs] });
      } else if (key === 'environments') {
        onChange({ ...value, environments: [...newValues, ...controlledOwnedEnvs] });
      } else {
        onChange({ ...value, [key]: newValues });
      }
    } else {
      setCycleError('');
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

  const handleSave = () => {
    const selectedSceneIds = localData.scenes;
    if (initial?.id && wouldCreateCycle(initial.id, selectedSceneIds, data?.scenes)) {
      setCycleError('One or more selected scenes would create a circular reference. Remove it before saving.');
      return;
    }
    setCycleError('');
    const envRefs = localData.environments;
    const advRefs = localData.adversaries.map(a => ({ adversaryId: a.id, count: a.count }));
    onSave({
      ...localData,
      environments: [...envRefs, ...ownedEnvironments],
      adversaries: [...advRefs, ...ownedAdversaries],
    });
  };

  const displayedOwnedEnvs = isControlled ? controlledOwnedEnvs : ownedEnvironments;
  const displayedOwnedAdvs = isControlled ? controlledOwnedAdvs : ownedAdversaries;
  const hasOwnedContent = displayedOwnedEnvs.length > 0 || displayedOwnedAdvs.length > 0;

  return (
    <div className="space-y-4">
      <FormRow label="Scene Name"><input type="text" value={fd.name} onChange={e => updateField('name', e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      <FormRow label="Description"><textarea value={fd.description} onChange={e => updateField('description', e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-2 text-white h-20 resize-none w-full" /></FormRow>
      <FormRow label="Image URL (optional)"><input type="url" placeholder="https://..." value={fd.imageUrl} onChange={e => updateField('imageUrl', e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      <CollectionRefPicker
        collections={SCENE_COLLECTIONS}
        values={pickerValues}
        onChange={handlePickerChange}
        data={data}
      />
      {cycleError && (
        <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded p-3">{cycleError}</div>
      )}
      {hasOwnedContent && (
        <div>
          <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Local Copies</div>
          <div className="flex flex-wrap gap-2">
            {displayedOwnedEnvs.map((entry, i) => (
              <span key={`env-${i}`} className="text-xs bg-amber-900/30 border border-amber-700/50 text-amber-300 px-2 py-1 rounded-full">
                {entry.data?.name || 'Unknown environment'} <span className="ml-1 text-amber-500/60 text-[10px]">env copy</span>
              </span>
            ))}
            {displayedOwnedAdvs.map((ref, i) => (
              <span key={`adv-${i}`} className="text-xs bg-amber-900/30 border border-amber-700/50 text-amber-300 px-2 py-1 rounded-full">
                {ref.data?.name || 'Unknown adversary'}{ref.count > 1 ? ` ×${ref.count}` : ''} <span className="ml-1 text-amber-500/60 text-[10px]">copy</span>
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1">Local copies can be edited from the Scene detail view.</p>
        </div>
      )}

      {!isControlled && (
        <div className="flex justify-between items-center mt-6 pt-6 border-t border-slate-800">
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-400">
            <input
              type="checkbox"
              checked={!!fd.is_public}
              onChange={e => updateField('is_public', e.target.checked)}
              className="accent-blue-500"
            />
            Make Public
          </label>
          <div className="flex gap-3">
            <button onClick={onCancel} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Save Scene</button>
          </div>
        </div>
      )}

      {isControlled && (
        <div className="mt-6 pt-4 border-t border-slate-800">
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-400">
            <input
              type="checkbox"
              checked={!!fd.is_public}
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
