import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link2, Plus, Search, Trash2 } from 'lucide-react';
import { TIERS, ENV_TYPES } from '../../lib/constants.js';
import { generateId } from '../../lib/helpers.js';
import { saveItem, ensureMirror } from '../../lib/api.js';
import { FormRow } from './FormRow.jsx';
import { FeaturesInput } from './FeaturesInput.jsx';
import { FeatureLibrary } from './FeatureLibrary.jsx';
import { ItemPickerModal } from '../modals/ItemPickerModal.jsx';
import { MarkdownHelpTooltip } from '../MarkdownHelpTooltip.jsx';

/**
 * Normalize the potential_adversaries field from any legacy or current format
 * into an array of { adversaryId?, name } objects.
 */
export function normalizePotentialAdversaries(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    return raw.split(',').map(s => s.trim()).filter(Boolean).map(name => ({ name }));
  }
  return [];
}

/**
 * Edit widget for the potential_adversaries field.
 *
 * entries: [{ adversaryId?, name }]
 * onChange(entries): called on every change
 * tier: current environment tier (used when creating a new adversary)
 */
function PotentialAdversariesInput({ entries, onChange, tier }) {
  const [pickerMode, setPickerMode] = useState(null); // null | 'add' | { linkIdx: number }
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const handlePickerSelect = async (item) => {
    if (item._source && !['own', 'srd', 'public'].includes(item._source)) {
      ensureMirror('adversaries', item);
    }
    if (typeof pickerMode === 'object' && pickerMode !== null && pickerMode.linkIdx !== undefined) {
      // Replacing a placeholder at linkIdx
      const updated = entries.map((e, i) =>
        i === pickerMode.linkIdx ? { adversaryId: item.id, name: item.name } : e
      );
      onChange(updated);
    } else {
      // Appending new linked reference; avoid duplicates
      if (!entries.find(e => e.adversaryId === item.id)) {
        onChange([...entries, { adversaryId: item.id, name: item.name }]);
      }
    }
    setPickerMode(null);
  };

  const handleAddPlaceholder = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onChange([...entries, { name: trimmed }]);
    setNewName('');
  };

  const handleCreateFromPlaceholder = async (idx) => {
    const entry = entries[idx];
    if (!entry || entry.adversaryId) return;
    setCreating(true);
    try {
      const newAdversary = {
        id: generateId(),
        name: entry.name,
        tier: tier || 1,
        role: 'standard',
        difficulty: 10,
        hp_max: 6,
        stress_max: 4,
        hp_thresholds: { major: 3, severe: 5 },
        attack: { name: '', range: 'Melee', modifier: 0, trait: 'Phy', damage: '' },
        experiences: [],
        features: [],
        description: '',
        motive: '',
        imageUrl: '',
      };
      const saved = await saveItem('adversaries', newAdversary);
      const savedId = saved?.id || newAdversary.id;
      const updated = entries.map((e, i) =>
        i === idx ? { adversaryId: savedId, name: entry.name } : e
      );
      onChange(updated);
    } catch (err) {
      console.error('Failed to create adversary:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleRemove = (idx) => onChange(entries.filter((_, i) => i !== idx));

  const pickerInitialSearch = typeof pickerMode === 'object' && pickerMode !== null
    ? entries[pickerMode.linkIdx]?.name
    : undefined;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex-1">Potential Adversaries</h4>
        <button
          type="button"
          onClick={() => setPickerMode('add')}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded px-2 py-1 transition-colors"
        >
          <Search size={11} /> Find
        </button>
      </div>

      {entries.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {entries.map((entry, idx) => {
            const isLinked = !!entry.adversaryId;
            return (
              <div
                key={idx}
                className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
                  isLinked
                    ? 'bg-slate-950 border border-slate-700'
                    : 'bg-slate-950 border border-dashed border-slate-600'
                }`}
              >
                {isLinked && <Link2 size={12} className="text-blue-400 shrink-0" />}
                <span className={`flex-1 truncate ${isLinked ? 'text-white' : 'text-slate-400 italic'}`}>
                  {entry.name}
                </span>
                {!isLinked && (
                  <>
                    <button
                      type="button"
                      title="Find and link an adversary"
                      onClick={() => setPickerMode({ linkIdx: idx })}
                      className="text-slate-500 hover:text-blue-400 shrink-0"
                    >
                      <Search size={13} />
                    </button>
                    <button
                      type="button"
                      title="Create a new adversary with this name"
                      onClick={() => handleCreateFromPlaceholder(idx)}
                      disabled={creating}
                      className="text-slate-500 hover:text-green-400 shrink-0 disabled:opacity-40"
                    >
                      <Plus size={13} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="text-slate-600 hover:text-red-500 shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Placeholder name…"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPlaceholder(); } }}
          className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-sm text-white placeholder-slate-600 outline-none focus:border-slate-500"
        />
        <button
          type="button"
          onClick={handleAddPlaceholder}
          disabled={!newName.trim()}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded px-2 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-default"
        >
          <Plus size={12} /> Add
        </button>
      </div>

      {pickerMode !== null && (
        <ItemPickerModal
          collection="adversaries"
          initialSearch={pickerInitialSearch}
          onClose={() => setPickerMode(null)}
          onSelect={handlePickerSelect}
        />
      )}
    </div>
  );
}

/**
 * Controlled mode: pass `value` (full formData) + `onChange(newFormData)`.
 * Uncontrolled mode: pass `initial`, `onSave`, `onCancel` (legacy path).
 * Save/Cancel buttons are only rendered in uncontrolled mode.
 */
export function EnvironmentForm({ initial, value, onChange, onSave, onCancel, featureLibraryPortal }) {
  const isControlled = value !== undefined;

  const [localData, setLocalData] = useState({
    name: initial?.name || '', tier: initial?.tier || 1, type: initial?.type || 'exploration',
    difficulty: initial?.difficulty || 10,
    description: initial?.description || '', impulses: initial?.impulses || '',
    imageUrl: initial?.imageUrl || '',
    features: (initial?.features || []).map(f => f.id ? f : { ...f, id: generateId() }),
    potential_adversaries: normalizePotentialAdversaries(initial?.potential_adversaries),
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

  // Ensure potential_adversaries is always a normalized array in controlled mode
  const potentialAdversaries = normalizePotentialAdversaries(formData.potential_adversaries);

  const addFeatureFromLibrary = feature => update({ ...formData, features: [...formData.features, { ...feature, id: generateId() }] });

  const featureLibraryEl = (
    <FeatureLibrary
      tier={formData.tier}
      subtype={formData.type}
      subtypeKey="type"
      currentFeatures={formData.features}
      onAdd={addFeatureFromLibrary}
    />
  );

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-2"><FormRow label="Name"><input type="text" value={formData.name} onChange={e => update({ ...formData, name: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow></div>
          <FormRow label="Tier">
            <select value={formData.tier} onChange={e => update({ ...formData, tier: parseInt(e.target.value) })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full">
              {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </FormRow>
          <FormRow label="Difficulty"><input type="number" value={formData.difficulty} onChange={e => update({ ...formData, difficulty: parseInt(e.target.value) || 0 })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
        </div>
        <FormRow label="Type">
          <select value={formData.type} onChange={e => update({ ...formData, type: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white">
            {ENV_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormRow>
        <FormRow label={<>Description<MarkdownHelpTooltip /></>}>
          <textarea value={formData.description} onChange={e => update({ ...formData, description: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white h-24 resize-none" />
        </FormRow>
        <FormRow label="Impulses">
          <input type="text" value={formData.impulses || ''} onChange={e => update({ ...formData, impulses: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" placeholder="e.g. Spread toxins, strip the land bare, end life" />
        </FormRow>

        <PotentialAdversariesInput
          entries={potentialAdversaries}
          onChange={potential_adversaries => update({ ...formData, potential_adversaries })}
          tier={formData.tier}
        />

        <FormRow label="Image URL (optional)"><input type="url" placeholder="https://..." value={formData.imageUrl} onChange={e => update({ ...formData, imageUrl: e.target.value })} className="bg-slate-950 border border-slate-700 rounded p-2 text-white w-full" /></FormRow>
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
              <button onClick={() => onSave(formData)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Save Environment</button>
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
