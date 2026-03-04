import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ROLES, TIERS, RANGES, DAMAGE_TYPES } from '../../lib/constants.js';
import { generateId } from '../../lib/helpers.js';
import { FormRow } from './FormRow.jsx';
import { CustomSelect } from './CustomSelect.jsx';
import { RoleSelect } from './RoleSelect.jsx';
import { GuideRangeDropdown } from './GuideRangeDropdown.jsx';
import { ExperiencesInput } from './ExperiencesInput.jsx';
import { FeaturesInput } from './FeaturesInput.jsx';
import { LibraryPanelStack } from './LibraryPanelStack.jsx';
import { MarkdownHelpTooltip } from '../MarkdownHelpTooltip.jsx';
import { ImageGenerator } from '../ImageGenerator.jsx';
import { AdversaryStatChangeModal } from '../modals/AdversaryStatChangeModal.jsx';
import {
  getBaselineStats,
  computeScaledStats,
  statsMatchBaseline,
  statsMatchGenericDefaults,
  ROLE_STAT_SCALING,
  getDicePoolOptions,
  getGuideRanges,
} from '../../lib/adversary-defaults.js';

/**
 * Controlled mode: pass `value` (full formData) + `onChange(newFormData)`.
 * Uncontrolled mode: pass `initial`, `onSave`, `onCancel` (legacy path).
 * Save/Cancel buttons are only rendered in uncontrolled mode.
 */
export function AdversaryForm({ initial, value, onChange, onSave, onCancel, featureLibraryPortal, onImageSaved }) {
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

  // When user changes tier/role with customized stats, we show this modal instead of window.confirm.
  const [pendingStatChange, setPendingStatChange] = useState(null);

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

    // Stats have been customized — show modal with before/after.
    if (tierChanged && !roleChanged && ROLE_STAT_SCALING[newRole]) {
      const scaled = computeScaledStats(formData, newRole, oldTier, newTier);
      setPendingStatChange({ newTier, newRole, mode: 'scale', afterStats: scaled });
    } else {
      setPendingStatChange({ newTier, newRole, mode: 'baseline', afterStats: newDefaults });
    }
  };

  const handleStatChangeApply = () => {
    if (!pendingStatChange) return;
    const { newTier, newRole, mode, afterStats } = pendingStatChange;
    if (mode === 'scale') {
      update({ ...formData, tier: newTier, ...afterStats });
    } else {
      update({ ...formData, tier: newTier, role: newRole, ...afterStats });
    }
    setPendingStatChange(null);
  };

  const handleStatChangeKeepCurrent = () => {
    if (!pendingStatChange) return;
    const { newTier, newRole } = pendingStatChange;
    update({ ...formData, tier: newTier, role: newRole });
    setPendingStatChange(null);
  };

  const [highlightedFeatureId, setHighlightedFeatureId] = useState(null);
  const [highlightedExperienceId, setHighlightedExperienceId] = useState(null);
  const highlightTimeoutRef = useRef(null);

  useEffect(() => {
    return () => { if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current); };
  }, []);

  const scheduleHighlightClear = (clearFeature) => {
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => {
      if (clearFeature) setHighlightedFeatureId(null);
      else setHighlightedExperienceId(null);
      highlightTimeoutRef.current = null;
    }, 1800);
  };

  const addFeatureFromLibrary = (feature) => {
    const id = generateId();
    update({ ...formData, features: [...formData.features, { ...feature, id }] });
    setHighlightedExperienceId(null);
    setHighlightedFeatureId(id);
    scheduleHighlightClear(true);
  };
  const addExperienceFromLibrary = (exp) => {
    const id = generateId();
    update({ ...formData, experiences: [...formData.experiences, { ...exp, id }] });
    setHighlightedFeatureId(null);
    setHighlightedExperienceId(id);
    scheduleHighlightClear(false);
  };

  const baseline = getBaselineStats(formData.role, formData.tier);
  const guideRanges = getGuideRanges(formData.role, formData.tier);

  const featureLibraryEl = (
    <LibraryPanelStack
      tier={formData.tier}
      subtype={formData.role}
      subtypeKey="role"
      currentFeatures={formData.features}
      onAddFeature={addFeatureFromLibrary}
      currentExperiences={formData.experiences}
      onAddExperience={addExperienceFromLibrary}
    />
  );

  return (
    <>
      <div className="space-y-4">
        <FormRow label="Name"><input type="text" value={formData.name} onChange={e => update({ ...formData, name: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>

        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Tier">
            <CustomSelect
              value={formData.tier}
              onChange={(tier) => handleTierOrRoleChange(tier, formData.role)}
              options={TIERS}
              getOptionLabel={(t) => String(t)}
            />
          </FormRow>
          <FormRow label="Role">
            <RoleSelect
              value={formData.role}
              onChange={(role) => handleTierOrRoleChange(formData.tier, role)}
            />
          </FormRow>
        </div>

        <FormRow label="Motives & Tactics"><input type="text" placeholder="e.g. To add to their bone collection" value={formData.motive} onChange={e => update({ ...formData, motive: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
        <FormRow label={<>Description (Flavor)<MarkdownHelpTooltip /></>}><textarea placeholder="Description or flavor text..." value={formData.description} onChange={e => update({ ...formData, description: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white h-20 resize-none w-full" /></FormRow>
        <FormRow label="Image URL (optional)">
          <div className="flex flex-wrap items-stretch border border-slate-700 rounded overflow-hidden">
            <input type="url" placeholder="https://..." value={formData.imageUrl} onChange={e => update({ ...formData, imageUrl: e.target.value })} className="flex-1 min-w-[12rem] bg-slate-950 border-0 px-2 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-inset" />
            <ImageGenerator formData={formData} collection="adversaries" onImageGenerated={url => { update({ ...formData, imageUrl: url }); onImageSaved?.(url); }} inline />
          </div>
        </FormRow>

        <div className="grid grid-cols-5 gap-4 mt-6">
          <FormRow label="Difficulty">
            <div className="flex items-center gap-2">
              <input type="number" value={formData.difficulty} onChange={e => update({ ...formData, difficulty: parseInt(e.target.value) })} className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded p-2 text-white" />
              {guideRanges?.difficulty && <GuideRangeDropdown tier={formData.tier} role={formData.role} guideRange={guideRanges.difficulty} value={formData.difficulty} onChange={(v) => update({ ...formData, difficulty: v })} />}
            </div>
          </FormRow>
          <FormRow label="Stress">
            <div className="flex items-center gap-2">
              <input type="number" value={formData.stress_max} onChange={e => update({ ...formData, stress_max: parseInt(e.target.value) })} className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded p-2 text-white" />
              {guideRanges?.stress_max && <GuideRangeDropdown tier={formData.tier} role={formData.role} guideRange={guideRanges.stress_max} value={formData.stress_max} onChange={(v) => update({ ...formData, stress_max: v })} />}
            </div>
          </FormRow>
          <FormRow label="HP">
            <div className="flex items-center gap-2">
              <input type="number" value={formData.hp_max} onChange={e => update({ ...formData, hp_max: parseInt(e.target.value) })} className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded p-2 text-white" />
              {guideRanges?.hp_max && <GuideRangeDropdown tier={formData.tier} role={formData.role} guideRange={guideRanges.hp_max} value={formData.hp_max} onChange={(v) => update({ ...formData, hp_max: v })} />}
            </div>
          </FormRow>
          <FormRow label="Major Threshold">
            <div className="flex items-center gap-2">
              <input type="number" value={formData.hp_thresholds.major} onChange={e => update({ ...formData, hp_thresholds: { ...formData.hp_thresholds, major: parseInt(e.target.value) } })} className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded p-2 text-white" />
              {guideRanges?.hp_thresholds?.major && <GuideRangeDropdown tier={formData.tier} role={formData.role} guideRange={guideRanges.hp_thresholds.major} value={formData.hp_thresholds.major} onChange={(v) => update({ ...formData, hp_thresholds: { ...formData.hp_thresholds, major: v }})} />}
            </div>
          </FormRow>
          <FormRow label="Severe Threshold">
            <div className="flex items-center gap-2">
              <input type="number" value={formData.hp_thresholds.severe} onChange={e => update({ ...formData, hp_thresholds: { ...formData.hp_thresholds, severe: parseInt(e.target.value) } })} className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded p-2 text-white" />
              {guideRanges?.hp_thresholds?.severe && <GuideRangeDropdown tier={formData.tier} role={formData.role} guideRange={guideRanges.hp_thresholds.severe} value={formData.hp_thresholds.severe} onChange={(v) => update({ ...formData, hp_thresholds: { ...formData.hp_thresholds, severe: v }})} />}
            </div>
          </FormRow>
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
                <input type="number" placeholder="+0" value={formData.attack.modifier} onChange={e => update({ ...formData, attack: { ...formData.attack, modifier: parseInt(e.target.value) || 0 } })} className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white" />
                {guideRanges?.attack?.modifier && <GuideRangeDropdown tier={formData.tier} role={formData.role} guideRange={guideRanges.attack.modifier} value={formData.attack.modifier} onChange={(v) => update({ ...formData, attack: { ...formData.attack, modifier: v }})} />}
              </div>
              <div className="col-span-8 flex items-center gap-2">
                <span className="text-sm text-slate-400">Dmg:</span>
                <input type="text" placeholder="e.g. d8+2" value={formData.attack.damage} onChange={e => update({ ...formData, attack: { ...formData.attack, damage: e.target.value } })} className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white" />
                {(() => {
                  const pools = getDicePoolOptions(formData.role, formData.tier);
                  if (pools.length === 0) return null;
                  return (
                    <GuideRangeDropdown
                      tier={formData.tier}
                      role={formData.role}
                      options={pools}
                      value={formData.attack.damage}
                      onChange={(v) => update({ ...formData, attack: { ...formData.attack, damage: v }})}
                      title="RightKnight's guide dice pools for this role and tier"
                    />
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        <ExperiencesInput experiences={formData.experiences} onChange={experiences => update({ ...formData, experiences })} highlightedId={highlightedExperienceId} />
        <FeaturesInput features={formData.features} onChange={features => update({ ...formData, features })} highlightedId={highlightedFeatureId} />

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

      {pendingStatChange && (
        <AdversaryStatChangeModal
          mode={pendingStatChange.mode}
          newTier={pendingStatChange.newTier}
          newRole={pendingStatChange.newRole}
          formData={formData}
          afterStats={pendingStatChange.afterStats}
          onApply={handleStatChangeApply}
          onKeepCurrent={handleStatChangeKeepCurrent}
          onClose={() => setPendingStatChange(null)}
        />
      )}
    </>
  );
}
