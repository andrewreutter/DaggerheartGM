import { useState } from 'react';
import { ROLES, TIERS, RANGES, DAMAGE_TYPES } from '../../lib/constants.js';
import { FormRow } from './FormRow.jsx';
import { ExperiencesInput } from './ExperiencesInput.jsx';
import { FeaturesInput } from './FeaturesInput.jsx';

export function AdversaryForm({ initial, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: initial?.name || '', tier: initial?.tier || 1, role: initial?.role || 'bruiser',
    motive: initial?.motive || '', description: initial?.description || '',
    imageUrl: initial?.imageUrl || '',
    difficulty: initial?.difficulty || 10, hp_max: initial?.hp_max || 6,
    hp_thresholds: initial?.hp_thresholds || { major: 3, severe: 5 }, stress_max: initial?.stress_max || 4,
    attack: initial?.attack || initial?.attacks?.[0] || { name: '', range: 'Melee', modifier: 0, trait: 'Phy', damage: '' },
    experiences: initial?.experiences || [], features: initial?.features || [],
    is_public: initial?.is_public || false,
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormRow label="Name"><input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" /></FormRow>
        <FormRow label="Role">
          <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white">
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </FormRow>
      </div>

      <FormRow label="Motives & Tactics"><input type="text" placeholder="e.g. To add to their bone collection" value={formData.motive} onChange={e => setFormData({ ...formData, motive: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
      <FormRow label="Description (Flavor)"><textarea placeholder="Description or flavor text..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white h-20 resize-none w-full" /></FormRow>
      <FormRow label="Image URL (optional)"><input type="url" placeholder="https://..." value={formData.imageUrl} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>

      <div className="grid grid-cols-3 gap-4 mt-6">
        <FormRow label="Tier">
          <select value={formData.tier} onChange={e => setFormData({ ...formData, tier: parseInt(e.target.value) })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full">
            {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormRow>
        <FormRow label="Difficulty"><input type="number" value={formData.difficulty} onChange={e => setFormData({ ...formData, difficulty: parseInt(e.target.value) })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" /></FormRow>
        <FormRow label="Stress"><input type="number" value={formData.stress_max} onChange={e => setFormData({ ...formData, stress_max: parseInt(e.target.value) })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" /></FormRow>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <FormRow label="HP"><input type="number" value={formData.hp_max} onChange={e => setFormData({ ...formData, hp_max: parseInt(e.target.value) })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" /></FormRow>
        <FormRow label="Major Threshold"><input type="number" value={formData.hp_thresholds.major} onChange={e => setFormData({ ...formData, hp_thresholds: { ...formData.hp_thresholds, major: parseInt(e.target.value) } })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" /></FormRow>
        <FormRow label="Severe Threshold"><input type="number" value={formData.hp_thresholds.severe} onChange={e => setFormData({ ...formData, hp_thresholds: { ...formData.hp_thresholds, severe: parseInt(e.target.value) } })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white" /></FormRow>
      </div>

      <div className="mt-6 border-t border-slate-800 pt-4">
        <h4 className="font-medium text-slate-300 mb-4">Attack</h4>
        <div className="bg-slate-950 p-3 rounded border border-slate-800 flex flex-col gap-3">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-5"><input type="text" placeholder="Attack Name" value={formData.attack.name} onChange={e => setFormData({ ...formData, attack: { ...formData.attack, name: e.target.value } })} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white" /></div>
            <div className="col-span-4">
              <select value={formData.attack.range} onChange={e => setFormData({ ...formData, attack: { ...formData.attack, range: e.target.value } })} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white">
                {RANGES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="col-span-3">
              <select value={formData.attack.trait} onChange={e => setFormData({ ...formData, attack: { ...formData.attack, trait: e.target.value } })} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white">
                {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-4 flex items-center gap-2">
              <span className="text-sm text-slate-400">Mod:</span>
              <input type="number" placeholder="+0" value={formData.attack.modifier} onChange={e => setFormData({ ...formData, attack: { ...formData.attack, modifier: parseInt(e.target.value) || 0 } })} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white" />
            </div>
            <div className="col-span-8 flex items-center gap-2">
              <span className="text-sm text-slate-400">Dmg:</span>
              <input type="text" placeholder="e.g. d8+2" value={formData.attack.damage} onChange={e => setFormData({ ...formData, attack: { ...formData.attack, damage: e.target.value } })} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white" />
            </div>
          </div>
        </div>
      </div>

      <ExperiencesInput experiences={formData.experiences} onChange={experiences => setFormData({ ...formData, experiences })} />
      <FeaturesInput features={formData.features} onChange={features => setFormData({ ...formData, features })} />

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
          <button onClick={() => onSave(formData)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Save Adversary</button>
        </div>
      </div>
    </div>
  );
}
