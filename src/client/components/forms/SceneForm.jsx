import { useState } from 'react';
import { FormRow } from './FormRow.jsx';
import { CollectionRefPicker } from './CollectionRefPicker.jsx';
import { MarkdownHelpTooltip } from '../MarkdownHelpTooltip.jsx';
import { computeSceneBudget } from '../../lib/battle-points.js';
import { ImageGenerator } from '../ImageGenerator.jsx';

const SCENE_COLLECTIONS = [
  { key: 'adversaries', label: 'Adversary', isCountable: true },
  { key: 'environments', label: 'Environment' },
  { key: 'scenes', label: 'Scene' },
];

const DEFAULT_BATTLE_MODS = {
  lessDifficult: false,
  damageBoostD4: false,
  damageBoostStatic: false,
  moreDangerous: false,
};

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
 * Builds a scene object in the canonical shape expected by battle-points utilities,
 * from the form's current data and owned copies.
 */
function buildSceneForBP(fd, ownedAdvs, ownedEnvs, isControlled, pickerValues) {
  const advRefs = isControlled
    ? (fd.adversaries || []).filter(a => a.adversaryId)
    : pickerValues.adversaries.map(a => ({ adversaryId: a.id, count: a.count }));
  const ownedAdvRefs = ownedAdvs || [];
  return {
    id: fd.id,
    adversaries: [...advRefs, ...ownedAdvRefs],
    scenes: isControlled ? (fd.scenes || []) : pickerValues.scenes,
    battleMods: fd.battleMods || DEFAULT_BATTLE_MODS,
  };
}

/**
 * Controlled mode: pass `value` (full assembled scene data) + `onChange(newFormData)`.
 * `value.adversaries` = [{adversaryId, count}, ...ownedCopies]
 * `value.environments` = [string, ...{data} objects]
 * In controlled mode CollectionRefPicker sees only ID refs; owned copies are read-only.
 *
 * Uncontrolled mode: pass `initial`, `onSave`, `onCancel` (legacy path).
 *
 * partySize / onPartySizeChange — global party size setting for BP budget calculation.
 */
export function SceneForm({ initial, value, onChange, data, onSave, onCancel, partySize = 4, onPartySizeChange }) {
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
    battleMods: initial?.battleMods || DEFAULT_BATTLE_MODS,
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
  const battleMods = fd.battleMods || DEFAULT_BATTLE_MODS;

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

  const updateBattleMod = (key, val) => {
    const newMods = { ...battleMods, [key]: val };
    // Damage boost options are mutually exclusive
    if (key === 'damageBoostD4' && val) newMods.damageBoostStatic = false;
    if (key === 'damageBoostStatic' && val) newMods.damageBoostD4 = false;
    updateField('battleMods', newMods);
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

  // --- Battle Budget calculation ---
  const sceneForBP = buildSceneForBP(fd, displayedOwnedAdvs, displayedOwnedEnvs, isControlled, pickerValues);
  const { tier, bp, budget, autoMods, totalMod, adjustedBudget } = computeSceneBudget(sceneForBP, data, partySize);

  const diff = bp - adjustedBudget;
  const diffColor = diff > 0 ? 'text-red-400' : diff < 0 ? 'text-emerald-400' : 'text-slate-400';

  return (
    <div className="space-y-4">
      <FormRow label="Scene Name"><input type="text" value={fd.name} onChange={e => updateField('name', e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      <FormRow label={<>Description<MarkdownHelpTooltip /></>}><textarea value={fd.description} onChange={e => updateField('description', e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-2 text-white h-20 resize-none w-full" /></FormRow>
      <FormRow label="Image URL (optional)"><input type="url" placeholder="https://..." value={fd.imageUrl} onChange={e => updateField('imageUrl', e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      <ImageGenerator formData={fd} collection="scenes" onImageGenerated={url => updateField('imageUrl', url)} />
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

      {/* Battle Budget */}
      <div className="mt-4 pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Battle Budget</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Party Size</span>
            <input
              type="number"
              min={1}
              max={8}
              value={partySize}
              onChange={e => onPartySizeChange && onPartySizeChange(Math.max(1, Math.min(8, parseInt(e.target.value) || 4)))}
              className="w-12 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-white text-sm text-center"
            />
          </div>
        </div>

        {/* BP summary row */}
        <div className="flex items-center gap-3 mb-3 bg-slate-900 rounded-lg px-3 py-2 border border-slate-800">
          {tier != null && (
            <span className="text-xs font-bold text-blue-300 border border-blue-700/50 bg-blue-900/30 rounded px-1.5 py-0.5">
              Tier {tier}
            </span>
          )}
          <span className="text-sm text-slate-300">
            <span className="font-semibold text-white">{bp}</span>
            <span className="text-slate-500"> BP</span>
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-sm text-slate-300">
            Budget <span className="font-semibold text-white">{adjustedBudget}</span>
            {totalMod !== 0 && (
              <span className={`ml-1 text-xs ${totalMod > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                ({totalMod > 0 ? '+' : ''}{totalMod} mod)
              </span>
            )}
          </span>
          {(bp > 0 || adjustedBudget > 0) && (
            <span className={`ml-auto text-xs font-semibold ${diffColor}`}>
              {diff === 0 ? 'On budget' : diff > 0 ? `+${diff} over` : `${Math.abs(diff)} under`}
            </span>
          )}
        </div>

        {/* Auto-detected modifier badges */}
        {(autoMods.twoOrMoreSolos.active || autoMods.lowerTierAdversary.active || autoMods.noHeavyRoles.active) && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {autoMods.twoOrMoreSolos.active && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 border border-red-700/50 text-red-300">
                2+ Solos −2
              </span>
            )}
            {autoMods.lowerTierAdversary.active && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/40 border border-emerald-700/50 text-emerald-300">
                Lower-tier adversary +1
              </span>
            )}
            {autoMods.noHeavyRoles.active && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/40 border border-emerald-700/50 text-emerald-300">
                No heavy roles +1
              </span>
            )}
          </div>
        )}

        {/* User-controlled modifiers */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-400 hover:text-slate-300">
            <input
              type="checkbox"
              checked={!!battleMods.lessDifficult}
              onChange={e => updateBattleMod('lessDifficult', e.target.checked)}
              className="accent-red-500"
            />
            <span>Less difficult / shorter fight</span>
            <span className="ml-auto text-xs text-red-400">−1</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-400 hover:text-slate-300">
            <input
              type="checkbox"
              checked={!!battleMods.damageBoostD4}
              onChange={e => updateBattleMod('damageBoostD4', e.target.checked)}
              className="accent-amber-500"
            />
            <span>+1d4 damage to all adversaries</span>
            <span className="ml-auto text-xs text-red-400">−2</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-400 hover:text-slate-300">
            <input
              type="checkbox"
              checked={!!battleMods.damageBoostStatic}
              onChange={e => updateBattleMod('damageBoostStatic', e.target.checked)}
              className="accent-amber-500"
            />
            <span>+2 damage to all adversaries</span>
            <span className="ml-auto text-xs text-red-400">−2</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-400 hover:text-slate-300">
            <input
              type="checkbox"
              checked={!!battleMods.moreDangerous}
              onChange={e => updateBattleMod('moreDangerous', e.target.checked)}
              className="accent-emerald-500"
            />
            <span>More dangerous / longer fight</span>
            <span className="ml-auto text-xs text-emerald-400">+2</span>
          </label>
        </div>
      </div>

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
