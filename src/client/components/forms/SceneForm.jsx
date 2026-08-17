import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { FormRow } from './FormRow.jsx';
import { MarkdownHelpTooltip } from '../MarkdownHelpTooltip.jsx';
import { ImageEditor } from './ImageEditor.jsx';
import { SceneTableEditor } from './SceneTableEditor.jsx';
import { ItemPickerModal } from '../modals/ItemPickerModal.jsx';
import { ItemCard } from '../ItemCard.jsx';
import { resolveItems } from '../../lib/api.js';
import { computeSceneBudget } from '../../lib/battle-points.js';
import { normalizeNextScenes } from '../../lib/scene-load-dialog.js';
import { getDimensionsForTab } from '../../lib/library-card-dimensions.js';
import { normalizeScenePartySize, normalizeScenePartyTier, normalizeSceneTableData } from '../../lib/scene-table-adapter.js';
import { collectPrivateReferencedMaps } from '../../lib/map-scene-public.js';
import { saveItem } from '../../lib/api.js';

/**
 * Scene library row: flat table_state-shaped snapshot. Each `maps[]` entry has a
 * scene-local `id` plus `libraryMapId` (current library art on Load Scene).
 * Make Public is blocked until every referenced Map is public.
 *
 * Stamp denormalized `tier` / `bp` so Library cards can read them without recomputing.
 * Uses the scene's designed `partySize` / `partyTier`, not the live table's PCs.
 * @param {object} scene
 */
function withSceneBattleFields(scene) {
  const normalized = normalizeSceneTableData(scene);
  const partySize = normalizeScenePartySize(normalized.partySize);
  const partyTier = normalizeScenePartyTier(normalized.partyTier);
  const { tier, bp } = computeSceneBudget(normalized, partySize, partyTier);
  return {
    ...scene,
    ...normalized,
    partySize,
    partyTier,
    tier,
    bp,
    nextScenes: normalizeNextScenes(scene.nextScenes ?? normalized.nextScenes),
  };
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
 * denormalized `tier` / `bp`, plus authored `nextScenes: [{ id, name }]`.
 */
export function SceneForm({
  initial,
  value,
  onChange,
  onSave,
  onCancel,
  onImageSaved,
  omitPublicCheckbox = false,
  libraryCardDimensions = null,
  userUid,
}) {
  const isControlled = value !== undefined;

  const [localData, setLocalData] = useState(() => withSceneBattleFields(initial || {}));
  // Jump straight into the (larger) Scene editor for an already-named scene; brand-new
  // scenes start on Details so there's somewhere to type a name first.
  const [activeTab, setActiveTab] = useState(() => ((isControlled ? value : initial)?.name ? 'scene' : 'details'));
  const [nextPickerOpen, setNextPickerOpen] = useState(false);
  const [nextSceneItemsById, setNextSceneItemsById] = useState({});
  const [mapsById, setMapsById] = useState({});
  const [publicGateError, setPublicGateError] = useState(null);

  const fd = isControlled ? (value || {}) : localData;
  const nextScenes = useMemo(() => normalizeNextScenes(fd.nextScenes), [fd.nextScenes]);
  const nextSceneKey = nextScenes.map((s) => s.id).join('\0');
  const { width: nextSceneCardWidth, height: nextSceneCardHeight } = useMemo(
    () => getDimensionsForTab(libraryCardDimensions, 'scenes', userUid),
    [libraryCardDimensions, userUid],
  );

  useEffect(() => {
    if (!nextScenes.length) {
      setNextSceneItemsById({});
      return undefined;
    }
    let cancelled = false;
    resolveItems({ scenes: nextScenes.map((s) => s.id) })
      .then((resolved) => {
        if (cancelled) return;
        const map = {};
        for (const item of resolved.scenes || []) {
          if (item?.id) map[item.id] = item;
        }
        setNextSceneItemsById(map);
      })
      .catch(() => {
        if (!cancelled) setNextSceneItemsById({});
      });
    return () => { cancelled = true; };
    // nextSceneKey is the stable identity of nextScenes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextSceneKey]);

  const mapLibKey = (Array.isArray(fd.maps) ? fd.maps : []).map((m) => m.libraryMapId).filter(Boolean).join('\0');
  useEffect(() => {
    const ids = mapLibKey ? mapLibKey.split('\0') : [];
    if (!ids.length) {
      setMapsById({});
      return undefined;
    }
    let cancelled = false;
    resolveItems({ maps: ids })
      .then((resolved) => {
        if (cancelled) return;
        const map = {};
        for (const item of resolved.maps || []) {
          if (item?.id) map[item.id] = item;
        }
        setMapsById(map);
      })
      .catch(() => {
        if (!cancelled) setMapsById({});
      });
    return () => { cancelled = true; };
  }, [mapLibKey]);
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
      nextScenes: latest.nextScenes,
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
    if (field === 'is_public' && val) {
      const priv = collectPrivateReferencedMaps(latestFdRef.current, mapsById);
      if (priv.length) {
        setPublicGateError(priv);
        return;
      }
    }
    setPublicGateError(null);
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
            <div className="mb-4 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-dh-muted">
                <input
                  type="checkbox"
                  checked={!!fd.is_public}
                  onChange={(e) => updateField('is_public', e.target.checked)}
                  className="accent-blue-500"
                  data-testid="scene-form-public"
                />
                Make Public
              </label>
              {publicGateError?.length > 0 && (
                <div className="text-xs text-amber-300 border border-amber-800/60 rounded p-2 space-y-2" data-testid="scene-public-map-gate">
                  <p>Publish is blocked until these maps are public:</p>
                  <ul className="list-disc pl-4">
                    {publicGateError.map((m) => (
                      <li key={m.id}>{m.name}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="px-2 py-1 rounded bg-sky-800 text-white"
                    onClick={async () => {
                      for (const m of publicGateError) {
                        const lib = mapsById[m.id] || { id: m.id, name: m.name };
                        await saveItem('maps', { ...lib, is_public: true });
                        setMapsById((prev) => ({ ...prev, [m.id]: { ...lib, is_public: true } }));
                      }
                      setPublicGateError(null);
                      emit({ ...latestFdRef.current, is_public: true });
                    }}
                  >
                    Make these maps public too
                  </button>
                </div>
              )}
            </div>
          )}
          <FormRow label="Next Scenes" className="mb-0">
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setNextPickerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-dh-raised hover:bg-dh-hover border border-dh-border hover:border-dh-strong text-dh hover:text-dh rounded transition-colors"
              >
                <Plus size={14} />
                Add Scene…
              </button>
              {nextScenes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {nextScenes.map((row) => {
                    const item = nextSceneItemsById[row.id] || { id: row.id, name: row.name || row.id };
                    const name = item.name || row.name || row.id;
                    return (
                      <div key={row.id} className="relative shrink-0">
                        <ItemCard
                          item={item}
                          tab="scenes"
                          cardWidth={nextSceneCardWidth}
                          cardHeight={nextSceneCardHeight}
                          onView={() => {}}
                          showSourceBadge
                        />
                        <button
                          type="button"
                          onClick={() => updateField(
                            'nextScenes',
                            nextScenes.filter((s) => s.id !== row.id),
                          )}
                          className="absolute top-1.5 right-1.5 z-10 p-1 rounded bg-dh-raised/90 border border-dh-border text-dh-muted hover:text-red-500 hover:border-red-700"
                          aria-label={`Remove ${name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </FormRow>
          {nextPickerOpen && (
            <ItemPickerModal
              collection="scenes"
              selectionMode="multi"
              overlayClassName="pt-[9.5rem]"
              excludeIds={[fd.id, ...nextScenes.map((s) => s.id)].filter(Boolean)}
              onClose={() => setNextPickerOpen(false)}
              onSelectMany={(picks) => {
                const incoming = (picks || []).map((p) => ({
                  id: p.item?.id,
                  name: p.item?.name || p.item?.id,
                }));
                updateField('nextScenes', normalizeNextScenes([
                  ...nextScenes,
                  ...incoming,
                ]));
                setNextPickerOpen(false);
              }}
            />
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
