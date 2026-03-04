import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ROLES, TIERS, RANGES, DAMAGE_TYPES } from '../../lib/constants.js';
import { generateId } from '../../lib/helpers.js';
import { FormRow } from './FormRow.jsx';
import { ExperiencesInput } from './ExperiencesInput.jsx';
import { FeaturesInput } from './FeaturesInput.jsx';
import { FeatureLibrary } from './FeatureLibrary.jsx';
import { MarkdownHelpTooltip } from '../MarkdownHelpTooltip.jsx';
import { ImageGenerator } from '../ImageGenerator.jsx';
import {
  getBaselineStats,
  computeScaledStats,
  statsMatchBaseline,
  statsMatchGenericDefaults,
  ROLE_STAT_SCALING,
} from '../../lib/adversary-defaults.js';

/**
 * Controlled mode: pass `value` (full formData) + `onChange(newFormData)`.
 * Uncontrolled mode: pass `initial`, `onSave`, `onCancel` (legacy path).
 * Save/Cancel buttons are only rendered in uncontrolled mode.
 */
export function AdversaryForm({ initial, value, onChange, onSave, onCancel, featureLibraryPortal }) {
  const isControlled = value !== undefined;

  const [localData, setLocalData] = useState({
    name: initial?.name || '', tier: initial?.tier || 1, role: initial?.role || 'standard',
    motive: initial?.motive || '', description: initial?.description || '',
    imageUrl: initial?.imageUrl || '',
    difficulty: initial?.difficulty || 10, hp_max: initial?.hp_max || 6,
    hp_thresholds: initial?.hp_thresholds || { major: 3, severe: 5 }, stress_max: initial?.stress_max || 4,
    attack: initial?.attack || initial?.attacks?.[0] || { name: '', range: 'Melee', modifier: 0, trait: 'Phy', damage: '' },
    experiences: (initial?.experiences || []).map(e => e.id ? e : { ...e, id: generateId() }),
    features: (initial?.features || []).map(f => f.id ? f : { ...f, id: generateId() }),
    is_public: initial?.is_public || false,
  });

  const formData = isControlled ? value : localData;

  const update = (newData) => {
    if (isControlled) {
      onChange(newData);
    } else {
      setLocalData(newData);
    }
  };

  /**
   * Smart handler for tier/role changes.
   *
   * - If stats are at generic initial values or at the baseline for the
   *   current role+tier, silently apply the new baseline.
   * - If stats have been customized and only the tier changed (and scaling
   *   data is available), offer to scale the values proportionally.
   * - If the role changed (or no scaling data), offer to replace with the
   *   new role's baseline.
   * - Declining any prompt applies only the tier/role change, leaving stats as-is.
   */
  const handleTierOrRoleChange = (newTier, newRole) => {
    const oldTier = formData.tier;
    const oldRole = formData.role;
    const tierChanged = newTier !== oldTier;
    const roleChanged = newRole !== oldRole;

    const newDefaults = getBaselineStats(newRole, newTier);

    // No baseline data for this combination — just apply the label change.
    if (!newDefaults) {
      update({ ...formData, tier: newTier, role: newRole });
      return;
    }

    const atOldBaseline = statsMatchBaseline(formData, oldRole, oldTier);
    const atGenericDefaults = statsMatchGenericDefaults(formData);

    if (atOldBaseline || atGenericDefaults) {
      // Stats are still at defaults — silently apply the new baseline.
      update({ ...formData, tier: newTier, role: newRole, ...newDefaults });
      return;
    }

    // Stats have been customized — ask before changing them.
    const capRole = r => r.charAt(0).toUpperCase() + r.slice(1);

    if (tierChanged && !roleChanged && ROLE_STAT_SCALING[newRole]) {
      // Tier-only change with scaling data available: offer proportional scaling.
      if (window.confirm(`Scale stats to Tier ${newTier}?\n\nThis adjusts Difficulty, HP, Thresholds, Stress, and Attack modifier by the guide's per-tier deltas while keeping your other customizations. Attack damage will use the Tier ${newTier} baseline pool.\n\nClick Cancel to change only the Tier label.`)) {
        const scaled = computeScaledStats(formData, newRole, oldTier, newTier);
        update({ ...formData, tier: newTier, ...scaled });
      } else {
        update({ ...formData, tier: newTier });
      }
    } else {
      // Role changed (or no scaling data for this role): offer full baseline replacement.
      if (window.confirm(`Apply recommended stats for ${capRole(newRole)} Tier ${newTier}?\n\nThis will replace Difficulty, HP, Thresholds, Stress, Attack modifier, and Attack damage with guide defaults.\n\nClick Cancel to change only the Tier/Role label.`)) {
        update({ ...formData, tier: newTier, role: newRole, ...newDefaults });
      } else {
        update({ ...formData, tier: newTier, role: newRole });
      }
    }
  };

  const addFeatureFromLibrary = feature => update({ ...formData, features: [...formData.features, { ...feature, id: generateId() }] });

  const featureLibraryEl = (
    <FeatureLibrary
      tier={formData.tier}
      subtype={formData.role}
      subtypeKey="role"
      currentFeatures={formData.features}
      onAdd={addFeatureFromLibrary}
    />
  );

  return (
    <>
      <div className="space-y-4">
        <FormRow label="Name"><input type="text" value={formData.name} onChange={e => update({ ...formData, name: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>

        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Tier">
            <select value={formData.tier} onChange={e => handleTierOrRoleChange(parseInt(e.target.value), formData.role)} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full">
              {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </FormRow>
          <FormRow label="Role">
            <select value={formData.role} onChange={e => handleTierOrRoleChange(formData.tier, e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full">
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </FormRow>
        </div>

        <FormRow label="Motives & Tactics"><input type="text" placeholder="e.g. To add to their bone collection" value={formData.motive} onChange={e => update({ ...formData, motive: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
        <FormRow label={<>Description (Flavor)<MarkdownHelpTooltip /></>}><textarea placeholder="Description or flavor text..." value={formData.description} onChange={e => update({ ...formData, description: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white h-20 resize-none w-full" /></FormRow>
        <FormRow label="Image URL (optional)"><input type="url" placeholder="https://..." value={formData.imageUrl} onChange={e => update({ ...formData, imageUrl: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
        <ImageGenerator formData={formData} collection="adversaries" onImageGenerated={url => update({ ...formData, imageUrl: url })} />

        <div className="grid grid-cols-5 gap-4 mt-6">
          <FormRow label="Difficulty"><input type="number" value={formData.difficulty} onChange={e => update({ ...formData, difficulty: parseInt(e.target.value) })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
          <FormRow label="Stress"><input type="number" value={formData.stress_max} onChange={e => update({ ...formData, stress_max: parseInt(e.target.value) })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
          <FormRow label="HP"><input type="number" value={formData.hp_max} onChange={e => update({ ...formData, hp_max: parseInt(e.target.value) })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
          <FormRow label="Major Threshold"><input type="number" value={formData.hp_thresholds.major} onChange={e => update({ ...formData, hp_thresholds: { ...formData.hp_thresholds, major: parseInt(e.target.value) } })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
          <FormRow label="Severe Threshold"><input type="number" value={formData.hp_thresholds.severe} onChange={e => update({ ...formData, hp_thresholds: { ...formData.hp_thresholds, severe: parseInt(e.target.value) } })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
        </div>

        <div className="mt-6 border-t border-slate-800 pt-4">
          <h4 className="font-medium text-slate-300 mb-4">Attack</h4>
          <div className="bg-slate-950 p-3 rounded border border-slate-800 flex flex-col gap-3">
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-5"><input type="text" placeholder="Attack Name" value={formData.attack.name} onChange={e => update({ ...formData, attack: { ...formData.attack, name: e.target.value } })} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white" /></div>
              <div className="col-span-4">
                <select value={formData.attack.range} onChange={e => update({ ...formData, attack: { ...formData.attack, range: e.target.value } })} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white">
                  {RANGES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="col-span-3">
                <select value={formData.attack.trait} onChange={e => update({ ...formData, attack: { ...formData.attack, trait: e.target.value } })} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white">
                  {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-4 flex items-center gap-2">
                <span className="text-sm text-slate-400">Mod:</span>
                <input type="number" placeholder="+0" value={formData.attack.modifier} onChange={e => update({ ...formData, attack: { ...formData.attack, modifier: parseInt(e.target.value) || 0 } })} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white" />
              </div>
              <div className="col-span-8 flex items-center gap-2">
                <span className="text-sm text-slate-400">Dmg:</span>
                <input type="text" placeholder="e.g. d8+2" value={formData.attack.damage} onChange={e => update({ ...formData, attack: { ...formData.attack, damage: e.target.value } })} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white" />
              </div>
            </div>
          </div>
        </div>

        <ExperiencesInput experiences={formData.experiences} onChange={experiences => update({ ...formData, experiences })} />
        <FeaturesInput features={formData.features} onChange={features => update({ ...formData, features })} />

        {!isControlled && (
          <div className="flex justify-between items-center mt-6 pt-6 border-t border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-400">
              <input
                type="checkbox"
                checked={!!formData.is_public}
                onChange={e => update({ ...formData, is_public: e.target.checked })}
                className="accent-blue-500"
              />
              Make Public
            </label>
            <div className="flex gap-3">
              <button onClick={onCancel} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
              <button onClick={() => onSave(formData)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Save Adversary</button>
            </div>
          </div>
        )}

        {isControlled && (
          <div className="mt-6 pt-4 border-t border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-400">
              <input
                type="checkbox"
                checked={!!formData.is_public}
                onChange={e => update({ ...formData, is_public: e.target.checked })}
                className="accent-blue-500"
              />
              Make Public
            </label>
          </div>
        )}
      </div>

      {featureLibraryPortal && createPortal(featureLibraryEl, featureLibraryPortal)}
    </>
  );
}
