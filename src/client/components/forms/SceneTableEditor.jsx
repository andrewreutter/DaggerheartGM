import { useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, StickyNote, Trash2, X } from 'lucide-react';
import { BattleMap } from '../BattleMap.jsx';
import { ItemPickerModal } from '../modals/ItemPickerModal.jsx';
import { SessionCountdownsPanel } from '../SessionCountdownsPanel.jsx';
import { EncounterAdversaryDifficultyRow, EncounterAdversaryInstanceCard } from '../EncounterAdversaryInstanceCard.jsx';
import { computeSceneBudget } from '../../lib/battle-points.js';
import {
  DEFAULT_SCENE_BATTLE_MODS,
  applySceneTableOp,
  buildSceneElementFromLibraryItem,
  buildSceneTableAdapterProps,
  normalizeSceneTableData,
} from '../../lib/scene-table-adapter.js';
import { generateId } from '../../lib/helpers.js';

const DIFFICULTY_KEYS = ['lessDifficult', 'slightlyMoreDangerous', 'moreDangerous'];
const DAMAGE_BOOST_KEYS = ['damageBoostPlusOne', 'damageBoostD4', 'damageBoostStatic'];

function groupSceneElements(activeElements) {
  const result = [];
  const seenAdvKeys = {};
  for (const el of activeElements || []) {
    if (el.elementType === 'note') {
      result.push({ kind: 'note', element: el });
    } else if (el.elementType === 'environment') {
      result.push({ kind: 'environment', element: el });
    } else if (el.elementType === 'adversary') {
      const key = el.id || el.instanceId;
      if (seenAdvKeys[key] === undefined) {
        seenAdvKeys[key] = result.length;
        result.push({ kind: 'adversary-group', baseElement: el, instances: [el] });
      } else {
        result[seenAdvKeys[key]].instances.push(el);
      }
    }
  }
  return result;
}

function cloneAdversaryInstance(el) {
  return {
    ...el,
    instanceId: generateId(),
    currentHp: el.hp_max || 0,
    currentStress: 0,
    conditions: '',
    tokenX: null,
    tokenY: null,
    mapId: null,
    altitude: 0,
  };
}

/**
 * BattleMap + Encounter-style side panel for editing a Scene's table snapshot.
 *
 * @param {object} props
 * @param {object} props.value — scene table slice (activeElements, maps, …)
 * @param {(next: object) => void} props.onChange
 * @param {number} [props.partySize]
 * @param {number|null} [props.partyTier]
 * @param {Array<{ name?: string, tier?: number }>} [props.characters]
 */
export function SceneTableEditor({
  value,
  onChange,
  partySize = 4,
  partyTier = 1,
  characters = [],
}) {
  const sceneData = normalizeSceneTableData(value);
  const viewportCenterRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const latestRef = useRef(sceneData);
  latestRef.current = sceneData;
  const [pickerCollection, setPickerCollection] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  const setSceneData = useCallback((updater) => {
    const prev = latestRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    latestRef.current = next;
    onChangeRef.current(next);
  }, []);

  const applyOp = useCallback((op) => {
    setSceneData((prev) => applySceneTableOp(prev, op));
  }, [setSceneData]);

  const battleMapCallbacks = useMemo(
    () => buildSceneTableAdapterProps(setSceneData, { viewportCenterRef }),
    [setSceneData],
  );

  const grouped = useMemo(() => groupSceneElements(sceneData.activeElements), [sceneData.activeElements]);
  const battleMods = sceneData.tableBattleMods || DEFAULT_SCENE_BATTLE_MODS;
  const { tier, bp, budget, autoMods, totalMod, adjustedBudget } = computeSceneBudget(
    sceneData,
    partySize,
    partyTier,
  );
  const diff = bp - adjustedBudget;
  const diffColor = diff > 0 ? 'text-red-400' : diff < 0 ? 'text-emerald-400' : 'text-dh-muted';

  const updateBattleMod = (key, checked) => {
    const next = { ...battleMods, [key]: checked };
    if (DAMAGE_BOOST_KEYS.includes(key) && checked) {
      for (const k of DAMAGE_BOOST_KEYS) if (k !== key) next[k] = false;
    }
    if (DIFFICULTY_KEYS.includes(key) && checked) {
      for (const k of DIFFICULTY_KEYS) if (k !== key) next[k] = false;
    }
    applyOp({ op: 'set-battle-mods', tableBattleMods: next });
  };

  const addLibraryItem = (item, collection) => {
    const el = buildSceneElementFromLibraryItem(item, collection);
    applyOp({ op: 'add-elements', elements: [el] });
  };

  const addEmptyNote = () => {
    applyOp({
      op: 'add-elements',
      elements: [buildSceneElementFromLibraryItem({ id: generateId(), name: 'Note', body: '' }, 'notes')],
    });
  };

  return (
    <div className="flex min-h-[36rem] h-full w-full min-w-0 overflow-hidden rounded-lg border border-dh-border bg-dh-canvas">
      <BattleMap
        {...battleMapCallbacks}
        activeElements={sceneData.activeElements}
        maps={sceneData.maps}
        mapViews={sceneData.mapViews}
        activeMapId={sceneData.activeMapId}
        gmActiveViewId={sceneData.gmActiveViewId}
        gmMapView={sceneData.gmMapView}
        mapConfig={sceneData.mapConfig}
        conditionsHistory={sceneData.conditionsHistory}
        onOpenImageLightbox={setLightboxUrl}
        className="flex-1 min-w-0 min-h-0"
      />

      <aside className="w-56 shrink-0 bg-dh-canvas border-l border-dh-border flex min-h-0 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
          {/* Battle budget + mods */}
          <div className="rounded-lg border border-dh-border bg-dh-surface overflow-hidden">
            <div className="px-2.5 py-2 flex items-center gap-2">
              {tier != null && (
                <span className="text-[10px] font-bold text-blue-300 border border-blue-700/50 bg-blue-900/30 rounded px-1.5 py-0.5">
                  T{tier}
                </span>
              )}
              <span className="text-xs text-dh">
                <span className="font-semibold text-white tabular-nums">{bp}</span>
                <span className="text-dh-muted"> BP</span>
              </span>
              <span className={`ml-auto text-[10px] font-semibold tabular-nums ${diffColor}`}>
                {diff === 0 ? 'On budget' : diff > 0 ? `+${diff}` : `${diff}`}
              </span>
            </div>
            <div className="border-t border-dh-border px-2.5 py-2 space-y-2">
              <div className="text-[10px] text-dh-muted">
                Budget <span className="font-semibold text-dh tabular-nums">{adjustedBudget}</span>
                {totalMod !== 0 && (
                  <span className={`ml-1 ${totalMod > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ({totalMod > 0 ? '+' : ''}{totalMod})
                  </span>
                )}
                <span className="text-dh-muted"> · {partySize} PC{partySize !== 1 ? 's' : ''}</span>
                <span className="sr-only">{budget}</span>
              </div>

              {(autoMods.twoOrMoreSolos.active || autoMods.lowerTierAdversary.active || autoMods.noHeavyRoles.active) && (
                <div className="flex flex-wrap gap-1">
                  {autoMods.twoOrMoreSolos.active && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-900/40 border border-red-700/50 text-red-300">
                      2+ Solos −2
                    </span>
                  )}
                  {autoMods.lowerTierAdversary.active && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-900/40 border border-emerald-700/50 text-emerald-300">
                      Lower-tier +1
                    </span>
                  )}
                  {autoMods.noHeavyRoles.active && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-900/40 border border-emerald-700/50 text-emerald-300">
                      No heavy roles +1
                    </span>
                  )}
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-dh-muted hover:text-dh">
                <input type="checkbox" checked={!!battleMods.lessDifficult} onChange={(e) => updateBattleMod('lessDifficult', e.target.checked)} className="accent-red-500" />
                <span>Less difficult</span>
                <span className="ml-auto text-[10px] text-red-400">−1</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-dh-muted hover:text-dh">
                <input type="checkbox" checked={!!battleMods.slightlyMoreDangerous} onChange={(e) => updateBattleMod('slightlyMoreDangerous', e.target.checked)} className="accent-emerald-500" />
                <span>Slightly more dangerous</span>
                <span className="ml-auto text-[10px] text-emerald-400">+1</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-dh-muted hover:text-dh">
                <input type="checkbox" checked={!!battleMods.moreDangerous} onChange={(e) => updateBattleMod('moreDangerous', e.target.checked)} className="accent-emerald-500" />
                <span>More dangerous</span>
                <span className="ml-auto text-[10px] text-emerald-400">+2</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-dh-muted hover:text-dh">
                <input type="checkbox" checked={!!battleMods.damageBoostPlusOne} onChange={(e) => updateBattleMod('damageBoostPlusOne', e.target.checked)} className="accent-amber-500" />
                <span>+1 damage</span>
                <span className="ml-auto text-[10px] text-red-400">−1</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-dh-muted hover:text-dh">
                <input type="checkbox" checked={!!battleMods.damageBoostD4} onChange={(e) => updateBattleMod('damageBoostD4', e.target.checked)} className="accent-amber-500" />
                <span>+1d4 damage</span>
                <span className="ml-auto text-[10px] text-red-400">−2</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-dh-muted hover:text-dh">
                <input type="checkbox" checked={!!battleMods.damageBoostStatic} onChange={(e) => updateBattleMod('damageBoostStatic', e.target.checked)} className="accent-amber-500" />
                <span>+2 damage</span>
                <span className="ml-auto text-[10px] text-red-400">−2</span>
              </label>
            </div>
          </div>

          {characters.length > 0 && autoMods.lowerTierAdversary.active && (
            <p className="text-[10px] text-sky-400/80 px-1 leading-snug">
              Party T{autoMods.lowerTierAdversary.partyTier ?? partyTier}
            </p>
          )}

          <div className="border-t border-dh-border" role="separator" />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-dh-muted">Notes</p>
            <button
              type="button"
              onClick={addEmptyNote}
              title="Add note"
              className="shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold text-dh-muted hover:text-dh hover:bg-dh-hover/60 transition-colors"
            >
              + Add
            </button>
          </div>
          {grouped.filter((item) => item.kind === 'note').map((item) => {
            const el = item.element;
            return (
              <div key={el.instanceId} className="rounded-lg border border-amber-900/50 bg-amber-950/25 px-2 py-1.5 space-y-1">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => applyOp({
                      op: 'update-element',
                      instanceId: el.instanceId,
                      updates: { visibility: el.visibility === 'gm' ? 'players' : 'gm' },
                    })}
                    className="shrink-0 rounded p-0.5 text-dh-muted hover:bg-dh-hover/60 hover:text-dh"
                    title={el.visibility === 'gm' ? 'GM only — click to show players' : 'Visible to players — click for GM only'}
                  >
                    {el.visibility === 'gm' ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                  <StickyNote size={12} className="shrink-0 text-amber-400/90" />
                  <input
                    type="text"
                    value={el.name || ''}
                    onChange={(e) => applyOp({
                      op: 'update-element',
                      instanceId: el.instanceId,
                      updates: { name: e.target.value },
                    })}
                    className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-amber-100/90 outline-none"
                    placeholder="Note"
                  />
                  <button
                    type="button"
                    onClick={() => applyOp({ op: 'remove-element', instanceId: el.instanceId })}
                    className="shrink-0 text-dh-muted hover:text-red-400 p-0.5"
                    title="Remove note"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <textarea
                  value={el.body || ''}
                  onChange={(e) => applyOp({
                    op: 'update-element',
                    instanceId: el.instanceId,
                    updates: { body: e.target.value },
                  })}
                  className="w-full bg-dh-inset/50 border border-amber-900/40 rounded p-1 text-[11px] text-dh resize-y min-h-[2.5rem]"
                  placeholder="Note text…"
                />
              </div>
            );
          })}

          <div className="border-t border-dh-border" role="separator" />
          <SessionCountdownsPanel
            variant="section"
            sectionTitle="Countdowns"
            sessionCountdowns={sceneData.sessionCountdowns}
            isGm
            onTableOp={applyOp}
          />

          <div className="border-t border-dh-border" role="separator" />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-dh-muted">Environments</p>
            <button
              type="button"
              onClick={() => setPickerCollection('environments')}
              title="Add environment"
              className="shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold text-dh-muted hover:text-dh hover:bg-dh-hover/60 transition-colors"
            >
              + Add
            </button>
          </div>
          {grouped.filter((item) => item.kind === 'environment').map((item) => {
            const el = item.element;
            return (
              <div key={el.instanceId} className="rounded-lg bg-emerald-950/30 border border-emerald-900/40 px-2.5 py-1.5 flex items-center gap-1.5 group/env">
                <span className="text-xs font-semibold text-emerald-300/80 truncate flex-1">{el.name || 'Environment'}</span>
                <button
                  type="button"
                  onClick={() => applyOp({ op: 'remove-element', instanceId: el.instanceId })}
                  className="hidden group-hover/env:block text-dh-muted hover:text-red-400 shrink-0"
                  title="Remove from scene"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}

          <div className="border-t border-dh-border" role="separator" />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-dh-muted">Adversaries</p>
            <button
              type="button"
              onClick={() => setPickerCollection('adversaries')}
              title="Add adversary"
              className="shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold text-dh-muted hover:text-dh hover:bg-dh-hover/60 transition-colors"
            >
              + Add
            </button>
          </div>
          {grouped.filter((item) => item.kind === 'adversary-group').map((item) => {
            const { baseElement: el, instances } = item;
            const count = instances.length;
            return (
              <div key={el.id || el.instanceId} className="rounded-lg bg-dh-surface border border-dh-border overflow-hidden group/adv">
                <div className="px-2.5 py-1.5 border-b border-dh-border flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-dh truncate flex-1">{el.name || 'Adversary'}</span>
                  {count > 1 && <span className="text-[10px] text-dh-muted shrink-0 group-hover/adv:hidden tabular-nums">×{count}</span>}
                  <div className="hidden group-hover/adv:flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => applyOp({ op: 'add-elements', elements: [cloneAdversaryInstance(el)] })}
                      className="w-4 h-4 rounded bg-dh-raised hover:bg-green-900 text-dh-muted hover:text-green-300 flex items-center justify-center text-[10px] font-bold transition-colors leading-none"
                      title="Add one more"
                    >
                      +
                    </button>
                    <span className="min-w-[1rem] text-center text-[10px] text-dh-muted font-semibold tabular-nums">{count}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (count === 1) {
                          if (window.confirm(`Remove ${el.name || 'this adversary'} from the scene?`)) {
                            applyOp({ op: 'remove-element', instanceId: instances[0].instanceId });
                          }
                        } else {
                          applyOp({ op: 'remove-element', instanceId: instances[instances.length - 1].instanceId });
                        }
                      }}
                      className="w-4 h-4 rounded bg-dh-raised hover:bg-red-900 text-dh-muted hover:text-red-300 flex items-center justify-center transition-colors leading-none"
                      title={count === 1 ? 'Remove from scene' : 'Remove one'}
                    >
                      {count === 1 ? <Trash2 size={9} /> : <span className="text-[10px] font-bold">−</span>}
                    </button>
                  </div>
                </div>
                <EncounterAdversaryDifficultyRow displayEl={el} />
                <div className="p-2 space-y-2">
                  {instances.map((inst, idx) => (
                    <div key={inst.instanceId}>
                      <EncounterAdversaryInstanceCard
                        displayEl={el}
                        inst={inst}
                        showInstanceNum={count > 1}
                        instanceNum={idx + 1}
                        showBp
                        showInstanceRemove={count > 1}
                        onRemoveInstance={(id) => applyOp({ op: 'remove-element', instanceId: id })}
                        canEditTracks
                        updateFn={(instanceId, updates) => applyOp({ op: 'update-element', instanceId, updates })}
                        conditionsHistory={sceneData.conditionsHistory}
                        onAddConditionsHistoryEntry={(entry) => applyOp({ op: 'add-conditions-history-entry', entry })}
                        onRemoveConditionsHistoryEntry={(entry) => applyOp({ op: 'remove-conditions-history-entry', entry })}
                      />
                      {idx < instances.length - 1 && <div className="border-t border-dh-border mt-1" />}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {pickerCollection && (
        <ItemPickerModal
          collection={pickerCollection}
          showDaggerstackImport={false}
          onClose={() => setPickerCollection(null)}
          onSelect={(item) => {
            addLibraryItem(item, pickerCollection);
            setPickerCollection(null);
          }}
        />
      )}

      {lightboxUrl && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 p-2 rounded-full bg-dh-raised/80 text-dh hover:bg-dh-hover"
            onClick={() => setLightboxUrl(null)}
          >
            <X size={20} />
          </button>
          <img
            src={lightboxUrl}
            alt="Enlarged image"
            className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body,
      )}
    </div>
  );
}
