import { useEffect, useRef, useState } from 'react';
import { FormRow } from './FormRow.jsx';
import { MarkdownHelpTooltip } from '../MarkdownHelpTooltip.jsx';
import { ImageEditor } from './ImageEditor.jsx';
import { SceneTableEditor } from './SceneTableEditor.jsx';
import { resolveItems } from '../../lib/api.js';
import { computeSceneBudget } from '../../lib/battle-points.js';
import { normalizeScenePartySize, normalizeScenePartyTier, normalizeSceneTableData } from '../../lib/scene-table-adapter.js';

/**
 * Stamp denormalized `tier` / `bp` so Library cards can read them without recomputing.
 * Uses the scene's designed `partySize` / `partyTier`, not the live table's PCs.
 * @param {object} scene
 */
function withSceneBattleFields(scene) {
  const normalized = normalizeSceneTableData(scene);
  const partySize = normalizeScenePartySize(normalized.partySize);
  const partyTier = normalizeScenePartyTier(normalized.partyTier);
  const { tier, bp } = computeSceneBudget(normalized, partySize, partyTier);
  return { ...scene, ...normalized, partySize, partyTier, tier, bp };
}

function sceneNeedsTableDefaults(scene) {
  if (!scene || typeof scene !== 'object') return true;
  if (!Array.isArray(scene.maps) || scene.maps.length === 0) return true;
  if (!Array.isArray(scene.activeElements)) return true;
  if (scene.tableBattleMods == null) return true;
  if (scene.partySize == null) return true;
  if (scene.partyTier == null) return true;
  if (scene.tier === undefined || scene.bp === undefined) return true;
  return false;
}

/**
 * Controlled mode: pass `value` (full assembled scene data) + `onChange(newFormData)`.
 * Uncontrolled mode: pass `initial`, `onSave`, `onCancel` (legacy path).
 *
 * Scene data is a flat table_state snapshot: `activeElements`, `maps`, `mapViews`,
 * `tableBattleMods`, designed `partySize` (default 4) / `partyTier` (default 1),
 * denormalized `tier` / `bp`.
 */
export function SceneForm({
  initial,
  value,
  onChange,
  onSave,
  onCancel,
  onImageSaved,
  omitPublicCheckbox = false,
}) {
  const isControlled = value !== undefined;

  const [localData, setLocalData] = useState(() => withSceneBattleFields(initial || {}));
  // Jump straight into the (larger) Scene editor for an already-named scene; brand-new
  // scenes start on Details so there's somewhere to type a name first.
  const [activeTab, setActiveTab] = useState(() => ((isControlled ? value : initial)?.name ? 'scene' : 'details'));

  const fd = isControlled ? (value || {}) : localData;
  const latestFdRef = useRef(fd);
  latestFdRef.current = fd;

  const emit = (next) => {
    const stamped = withSceneBattleFields(next);
    latestFdRef.current = stamped;
    if (isControlled) onChange(stamped);
    else setLocalData(stamped);
  };

  const onTableChange = (tableSlice) => {
    const latest = latestFdRef.current || {};
    emit({
      ...latest,
      ...tableSlice,
      name: latest.name,
      description: latest.description,
      imageUrl: latest.imageUrl,
      _additionalImages: latest._additionalImages,
      is_public: latest.is_public,
      id: latest.id,
    });
  };

  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    const source = isControlled ? (value || {}) : localData;
    if (sceneNeedsTableDefaults(source)) {
      emit(withSceneBattleFields(source));
    }
    // Seed once so new scenes persist maps / tableBattleMods / partySize / partyTier / tier / bp.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateField = (field, val) => {
    emit({ ...latestFdRef.current, [field]: val });
  };

  const handleSave = () => {
    onSave?.(withSceneBattleFields(localData));
  };

  const tabBtnClass = (tab) =>
    `px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
      activeTab === tab
        ? 'border-red-500 text-dh'
        : 'border-transparent text-dh-muted hover:text-dh'
    }`;

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0">
      <div className="shrink-0 flex items-center gap-1 border-b border-dh-border mb-3" role="tablist">
        <button type="button" role="tab" aria-selected={activeTab === 'details'} onClick={() => setActiveTab('details')} className={tabBtnClass('details')}>
          Details
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'scene'} onClick={() => setActiveTab('scene')} className={tabBtnClass('scene')}>
          Scene
        </button>
      </div>

      {/* SceneTableEditor always stays in layout (invisible, not display:none) so the
          Details tab keeps the same dialog height as Scene and doesn't jump on switch.
          Details overlays when active; Scene stays mounted for BattleMap pan/zoom state. */}
      <div className="relative flex-1 min-h-0 min-w-0 flex flex-col">
        <div
          className={
            activeTab === 'details'
              ? 'absolute inset-0 z-10 overflow-y-auto space-y-3 bg-dh-surface'
              : 'hidden'
          }
        >
          <FormRow label="Scene Name" className="mb-0">
            <input
              type="text"
              value={fd.name || ''}
              onChange={(e) => updateField('name', e.target.value)}
              className="bg-dh-inset border border-dh-border rounded p-2 text-dh w-full"
            />
          </FormRow>
          <FormRow label={<>Description<MarkdownHelpTooltip /></>} className="mb-0">
            <textarea
              value={fd.description || ''}
              onChange={(e) => updateField('description', e.target.value)}
              className="bg-dh-inset border border-dh-border rounded p-2 text-dh h-16 resize-none w-full"
            />
          </FormRow>
          <FormRow label="Cover art (optional)" className="mb-0">
            <ImageEditor
              imageUrl={fd.imageUrl}
              _additionalImages={fd._additionalImages}
              onChange={({ imageUrl, _additionalImages }) => emit({ ...latestFdRef.current, imageUrl, _additionalImages })}
              onImageSaved={onImageSaved}
              collection="scenes"
              formData={fd}
              inline
            />
          </FormRow>
          {!omitPublicCheckbox && (
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-dh-muted">
              <input
                type="checkbox"
                checked={!!fd.is_public}
                onChange={(e) => updateField('is_public', e.target.checked)}
                className="accent-blue-500"
              />
              Make Public
            </label>
          )}
        </div>

        <div
          className={`flex-1 min-h-0 min-w-0 flex flex-col${activeTab === 'scene' ? '' : ' invisible pointer-events-none'}`}
          aria-hidden={activeTab !== 'scene'}
        >
          <SceneTableEditor
            value={fd}
            onChange={onTableChange}
            resolveItems={resolveItems}
          />
        </div>
      </div>

      {!isControlled && (
        <div className="flex items-center justify-end mt-3 pt-3 border-t border-dh-border shrink-0 gap-3">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-dh-muted hover:text-white">Cancel</button>
          <button type="button" onClick={handleSave} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">Save Scene</button>
        </div>
      )}
    </div>
  );
}
