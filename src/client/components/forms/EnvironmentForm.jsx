import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { Link2, Plus, Search, Trash2 } from 'lucide-react';
import { TIERS, ENV_TYPES } from '../../lib/constants.js';
import { coerceEnvironmentType, coerceEnvironmentTier } from '../../lib/environment-coerce.js';
import { generateId } from '../../lib/helpers.js';
import { saveItem, ensureMirror } from '../../lib/api.js';
import { FormRow } from './FormRow.jsx';
import { CustomSelect } from './CustomSelect.jsx';
import { FeaturesInput } from './FeaturesInput.jsx';
import { FeatureLibrary } from './FeatureLibrary.jsx';
import { ItemPickerModal } from '../modals/ItemPickerModal.jsx';
import { MarkdownHelpTooltip } from '../MarkdownHelpTooltip.jsx';
import { ImageEditor } from './ImageEditor.jsx';
import { ConceptAiStrip } from '../ConceptAiStrip.jsx';
import { postEnvironmentAiBuild } from '../../lib/api.js';

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

export { coerceEnvironmentType, coerceEnvironmentTier };

const ENV_TYPE_LABEL = {
  traversal: 'Traversal',
  exploration: 'Exploration',
  social: 'Social',
  event: 'Event',
};

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
        <h4 className="text-xs font-semibold text-dh-muted uppercase tracking-wide flex-1">Potential Adversaries</h4>
        <button
          type="button"
          onClick={() => setPickerMode('add')}
          className="flex items-center gap-1 text-xs text-dh-muted hover:text-white border border-dh-border hover:border-dh-strong rounded px-2 py-1 transition-colors"
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
                    ? 'bg-dh-inset border border-dh-border'
                    : 'bg-dh-inset border border-dashed border-dh-strong'
                }`}
              >
                {isLinked && <Link2 size={12} className="text-blue-400 shrink-0" />}
                <span className={`flex-1 truncate ${isLinked ? 'text-white' : 'text-dh-muted italic'}`}>
                  {entry.name}
                </span>
                {!isLinked && (
                  <>
                    <button
                      type="button"
                      title="Find and link an adversary"
                      onClick={() => setPickerMode({ linkIdx: idx })}
                      className="text-dh-muted hover:text-blue-400 shrink-0"
                    >
                      <Search size={13} />
                    </button>
                    <button
                      type="button"
                      title="Create a new adversary with this name"
                      onClick={() => handleCreateFromPlaceholder(idx)}
                      disabled={creating}
                      className="text-dh-muted hover:text-green-400 shrink-0 disabled:opacity-40"
                    >
                      <Plus size={13} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="text-dh-muted hover:text-red-500 shrink-0"
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
          className="flex-1 bg-dh-inset border border-dh-border rounded px-2 py-1.5 text-sm text-dh placeholder-dh-muted outline-none focus:border-dh-strong"
        />
        <button
          type="button"
          onClick={handleAddPlaceholder}
          disabled={!newName.trim()}
          className="flex items-center gap-1 text-xs text-dh-muted hover:text-white border border-dh-border hover:border-dh-strong rounded px-2 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-default"
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
export function EnvironmentForm({
  initial,
  value,
  onChange,
  onSave,
  onCancel,
  featureLibraryPortal,
  onImageSaved,
  omitPublicCheckbox = false,
  onAiBusyChange,
  autoRunAiConcept,
  onAutoRunAiConceptConsumed,
  autoRunSessionKey = '',
}) {
  const isControlled = value !== undefined;

  const [localData, setLocalData] = useState({
    name: initial?.name || '', tier: initial?.tier || 1, type: initial?.type || 'exploration',
    difficulty: initial?.difficulty ?? 10,
    description: initial?.description || '', impulses: initial?.impulses || '',
    imageUrl: initial?.imageUrl || '', _additionalImages: initial?._additionalImages || [],
    features: (initial?.features || []).map(f => f.id ? f : { ...f, id: generateId() }),
    potential_adversaries: normalizePotentialAdversaries(initial?.potential_adversaries),
    is_public: initial?.is_public || false,
  });

  const formData = isControlled ? value : localData;
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const aiStripRef = useRef(null);
  const [aiBusy, setAiBusy] = useState(false);

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

  const displayTier = coerceEnvironmentTier(formData.tier) ?? 1;
  const displayType = coerceEnvironmentType(formData.type);
  // Tier/type must be valid for the API; missing tier (new/legacy rows) coerces via displayTier — use ?? 1 so "unset" is not blocked.
  const environmentConceptAiReady =
    coerceEnvironmentTier(formData.tier ?? 1) != null && ENV_TYPES.includes(displayType);

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
      <div className="space-y-4 p-1 relative">
        <div className="relative">
          {aiBusy ? (
            <>
              <div
                className="absolute inset-0 z-10 min-h-[200px] rounded-md bg-dh-canvas/60 backdrop-blur-[1px] pointer-events-none"
                aria-hidden
              />
              <div className="absolute inset-0 z-20 flex items-start justify-center pt-20 pointer-events-none">
                <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-dh-strong bg-dh-surface px-4 py-3 shadow-xl">
                  <Loader2 size={22} className="animate-spin text-violet-400 shrink-0" aria-hidden />
                  <span className="text-sm text-dh-muted">Building environment…</span>
                  <button
                    type="button"
                    onClick={() => {
                      aiStripRef.current?.cancel();
                    }}
                    className="text-sm font-medium px-2.5 py-1 rounded-md border border-dh-border text-dh hover:bg-dh-raised transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </>
          ) : null}
          <div className={aiBusy ? 'pointer-events-none select-none opacity-[0.68]' : ''}>
        <FormRow label="Name"><input type="text" value={formData.name} onChange={e => update({ ...formData, name: e.target.value })} className="bg-dh-inset border border-dh-border rounded p-2 text-dh w-full" /></FormRow>
        <div className="grid grid-cols-[minmax(0,4.75rem)_minmax(0,1fr)_minmax(0,6rem)] gap-x-3 gap-y-1 items-end mb-4">
          <FormRow label="Tier" className="mb-0 min-w-0">
            <CustomSelect
              value={displayTier}
              onChange={(tier) => update({ ...formData, tier })}
              options={TIERS}
              getOptionLabel={(t) => String(t)}
              className="min-w-0"
            />
          </FormRow>
          <FormRow label="Type" className="mb-0 min-w-0">
            <CustomSelect
              value={displayType}
              onChange={(type) => update({ ...formData, type })}
              options={ENV_TYPES}
              getOptionLabel={(t) => ENV_TYPE_LABEL[t] ?? t}
              className="min-w-0 w-full"
            />
          </FormRow>
          <FormRow label="Difficulty" className="mb-0 min-w-0">
            <input
              type="number"
              value={formData.difficulty ?? 10}
              onChange={e => update({ ...formData, difficulty: parseInt(e.target.value, 10) || 0 })}
              className="w-full min-w-0 bg-dh-inset border border-dh-border rounded p-2 text-dh"
            />
          </FormRow>
        </div>

        <ConceptAiStrip
          ref={aiStripRef}
          postBuild={(concept, opts) =>
            postEnvironmentAiBuild(concept, {
              ...opts,
              tier: coerceEnvironmentTier(formDataRef.current.tier) ?? 1,
              type: coerceEnvironmentType(formDataRef.current.type),
            })
          }
          getMergeBase={() => formDataRef.current}
          onComplete={(merged) => update(merged)}
          onAiBusyChange={(busy) => {
            setAiBusy(busy);
            onAiBusyChange?.(busy);
          }}
          showBuildButtonSpinner={false}
          initialConcept={autoRunAiConcept}
          initialConceptKey={autoRunSessionKey}
          autoSubmitKey={autoRunAiConcept?.trim() ? autoRunSessionKey : undefined}
          onPendingConsumed={onAutoRunAiConceptConsumed}
          prerequisitesReady={environmentConceptAiReady}
          prerequisitesHint="Set tier and type above to load matching SRD examples."
          labels={{
            title: 'Describe an environment concept, we’ll draft features and tone',
            placeholder: 'e.g. A flooded cathedral nave where stained glass casts sickly light and something hums below…',
            buildButton: 'Build with AI',
            summaryTitle: 'AI picks summary',
          }}
        />

        <FormRow label={<>Description<MarkdownHelpTooltip /></>}>
          <textarea value={formData.description} onChange={e => update({ ...formData, description: e.target.value })} className="bg-dh-inset border border-dh-border rounded p-2 text-dh h-24 resize-none" />
        </FormRow>
        <FormRow label="Impulses">
          <input type="text" value={formData.impulses || ''} onChange={e => update({ ...formData, impulses: e.target.value })} className="bg-dh-inset border border-dh-border rounded p-2 text-dh w-full" placeholder="e.g. Spread toxins, strip the land bare, end life" />
        </FormRow>

        <PotentialAdversariesInput
          entries={potentialAdversaries}
          onChange={potential_adversaries => update({ ...formData, potential_adversaries })}
          tier={formData.tier}
        />

        <FormRow label="Images (optional)">
          <ImageEditor
            imageUrl={formData.imageUrl}
            _additionalImages={formData._additionalImages}
            onChange={({ imageUrl, _additionalImages }) => update({ ...formData, imageUrl, _additionalImages })}
            onImageSaved={onImageSaved}
            collection="environments"
            formData={formData}
          />
        </FormRow>
        <FeaturesInput features={formData.features} onChange={features => update({ ...formData, features })} />

        {!isControlled && (
          <div className={`flex items-center mt-6 pt-6 border-t border-dh-border ${omitPublicCheckbox ? 'justify-end' : 'justify-between'}`}>
            {!omitPublicCheckbox && (
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-dh-muted">
                <input
                  type="checkbox"
                  checked={!!formData.is_public}
                  onChange={e => update({ ...formData, is_public: e.target.checked })}
                  className="accent-blue-500"
                />
                Make Public
              </label>
            )}
            <div className="flex gap-3">
              <button onClick={onCancel} className="px-4 py-2 text-dh-muted hover:text-white">Cancel</button>
              <button onClick={() => onSave(formData)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Save Environment</button>
            </div>
          </div>
        )}

        {isControlled && !omitPublicCheckbox && (
          <div className="mt-6 pt-4 border-t border-dh-border">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-dh-muted">
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
        </div>
      </div>

      {featureLibraryPortal && createPortal(featureLibraryEl, featureLibraryPortal)}
    </>
  );
}
