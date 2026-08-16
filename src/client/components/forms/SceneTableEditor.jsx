import { useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, StickyNote, Trash2, X } from 'lucide-react';
import { BattleMap } from '../BattleMap.jsx';
import { ItemPickerModal } from '../modals/ItemPickerModal.jsx';
import { EncounterNoteEditorModal } from '../modals/EncounterNoteEditorModal.jsx';
import { SessionCountdownsPanel } from '../SessionCountdownsPanel.jsx';
import { EncounterAdversaryDifficultyRow, EncounterAdversaryInstanceCard } from '../EncounterAdversaryInstanceCard.jsx';
import { EncounterAdversaryTypeCard } from '../EncounterAdversaryTypeCard.jsx';
import {
  GmMovesOverlay,
  GmMovesTrigger,
  useGmMovesCameraPartition,
  useGmMovesOverlay,
} from '../GmMovesPanel.jsx';
import { computeSceneBudget } from '../../lib/battle-points.js';
import { buildLibraryAdversaryElements } from '../../lib/party-scaled-adversaries.js';
import { MarkdownText } from '../../lib/markdown.js';
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

/**
 * BattleMap + Encounter-style side panel for editing a Scene's table snapshot
 * (including a GM Moves preview of the live-table board).
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
  const [editingNote, setEditingNote] = useState(null);
  const gmMovesOverlay = useGmMovesOverlay();
  const { inViewAdvCardKeys, mapViewportKnown, onViewportFt } = useGmMovesCameraPartition(
    sceneData.activeElements,
  );

  const setSceneData = useCallback((updater) => {
    const prev = latestRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    latestRef.current = next;
    onChangeRef.current(next);
  }, []);

  const applyOp = useCallback((op) => {
    setSceneData((prev) => applySceneTableOp(prev, op));
  }, [setSceneData]);

  const battleMapCallbacks = useMemo(() => {
    const base = buildSceneTableAdapterProps(setSceneData, { viewportCenterRef });
    const adapterOnViewport = base.onViewportCenterChange;
    return {
      ...base,
      onViewportCenterChange: (center) => {
        adapterOnViewport?.(center);
        onViewportFt(center?.viewportFt);
      },
    };
  }, [setSceneData, onViewportFt]);

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

  const addLibraryPicks = (picks, collection) => {
    const elements = [];
    for (const { item, count } of picks || []) {
      if (collection === 'adversaries') {
        elements.push(...buildLibraryAdversaryElements(item, {
          characterCount: partySize,
          copies: count,
        }));
      } else {
        const el = buildSceneElementFromLibraryItem(item, collection);
        if (el) elements.push(el);
      }
    }
    if (elements.length) applyOp({ op: 'add-elements', elements });
  };

  const addEmptyNote = () => {
    const el = buildSceneElementFromLibraryItem({ id: generateId(), name: 'Note', body: '' }, 'notes');
    applyOp({ op: 'add-elements', elements: [el] });
    setEditingNote(el);
  };

  return (
    <div className="relative flex min-h-[36rem] h-full w-full min-w-0 overflow-hidden rounded-lg border border-dh-border bg-dh-canvas">
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

      <aside className="relative z-10 w-56 shrink-0 bg-dh-canvas border-l border-dh-border flex min-h-0 flex-col overflow-hidden">
        <div className="sticky top-0 z-10 border-b border-dh-border bg-dh-canvas px-2 py-2">
          <GmMovesTrigger
            overlay={gmMovesOverlay}
            activeElements={sceneData.activeElements}
            characterCount={partySize}
          />
        </div>
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
            const noteBodyTrimmed = String(el.body || '').trim();
            const noteTitleOnly = !noteBodyTrimmed && !el.imageUrl;
            return (
              <div
                key={el.instanceId}
                className={`flex gap-1 rounded-lg border border-amber-900/50 bg-amber-950/25 px-2 transition-colors hover:border-amber-700/60 hover:bg-amber-950/40 ${noteTitleOnly ? 'py-1.5' : 'py-2'}`}
              >
                <button
                  type="button"
                  onClick={() => applyOp({
                    op: 'update-element',
                    instanceId: el.instanceId,
                    updates: { visibility: el.visibility === 'gm' ? 'players' : 'gm' },
                  })}
                  className="shrink-0 self-start rounded p-0.5 text-dh-muted hover:bg-dh-hover/60 hover:text-dh"
                  title={el.visibility === 'gm' ? 'GM only — click to show players' : 'Visible to players — click for GM only'}
                  aria-label={el.visibility === 'gm' ? 'Show to players' : 'GM only'}
                  aria-pressed={el.visibility === 'gm'}
                >
                  {el.visibility === 'gm' ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingNote(el)}
                  className="flex min-w-0 flex-1 items-start gap-2 text-left"
                >
                  {el.imageUrl ? (
                    <span className="mt-0.5 h-10 w-10 shrink-0 overflow-hidden rounded border border-amber-800/50 bg-dh-inset">
                      <img src={el.imageUrl} alt="" className="h-full w-full object-cover" />
                    </span>
                  ) : (
                    <StickyNote size={14} className="mt-0.5 shrink-0 text-amber-400/90" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-amber-100/90">{el.name || 'Note'}</div>
                    {noteBodyTrimmed ? (
                      <div className="mt-1 max-h-24 overflow-hidden text-left">
                        <MarkdownText text={noteBodyTrimmed} className="dh-md text-[11px] leading-snug text-dh-muted line-clamp-6" />
                      </div>
                    ) : null}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => applyOp({ op: 'remove-element', instanceId: el.instanceId })}
                  className="shrink-0 self-start text-dh-muted hover:text-red-400 p-0.5"
                  title="Remove note"
                >
                  <Trash2 size={12} />
                </button>
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
            const isMinion = el.role === 'minion';
            return (
              <EncounterAdversaryTypeCard
                key={el.id || el.instanceId}
                displayName={el.name || 'Adversary'}
                instances={instances}
                isMinion={isMinion}
                characterCount={null}
                scalePartySize={partySize}
                onAddElements={(els) => applyOp({ op: 'add-elements', elements: els })}
                onRemoveInstanceIds={(ids) => ids.forEach((id) => applyOp({ op: 'remove-element', instanceId: id }))}
                onSetMinPartySize={(ids, n) => {
                  const minPartySize = n > 1 ? n : 1;
                  ids.forEach((id) => applyOp({ op: 'update-element', instanceId: id, updates: { minPartySize } }));
                }}
                afterHeader={<EncounterAdversaryDifficultyRow displayEl={el} />}
                renderInstance={({ inst, showInstanceNum, instanceNum, scaleTag }) => (
                  <EncounterAdversaryInstanceCard
                    displayEl={el}
                    inst={inst}
                    showInstanceNum={showInstanceNum}
                    instanceNum={instanceNum}
                    showBp
                    showInstanceRemove={!isMinion && instances.length > 1}
                    onRemoveInstance={(id) => applyOp({ op: 'remove-element', instanceId: id })}
                    canEditTracks
                    updateFn={(instanceId, updates) => applyOp({ op: 'update-element', instanceId, updates })}
                    conditionsHistory={sceneData.conditionsHistory}
                    onAddConditionsHistoryEntry={(entry) => applyOp({ op: 'add-conditions-history-entry', entry })}
                    onRemoveConditionsHistoryEntry={(entry) => applyOp({ op: 'remove-conditions-history-entry', entry })}
                    scaleTag={scaleTag}
                  />
                )}
              />
            );
          })}
        </div>
      </aside>

      <GmMovesOverlay
        overlay={gmMovesOverlay}
        activeElements={sceneData.activeElements}
        characterCount={partySize}
        inViewAdvCardKeys={inViewAdvCardKeys}
        mapViewportKnown={mapViewportKnown}
      />

      {pickerCollection && (
        <ItemPickerModal
          collection={pickerCollection}
          showDaggerstackImport={false}
          selectionMode="multi"
          partySize={partySize}
          partyTier={partyTier}
          onClose={() => setPickerCollection(null)}
          onSelectMany={(picks) => {
            addLibraryPicks(picks, pickerCollection);
            setPickerCollection(null);
          }}
        />
      )}

      {editingNote && (
        <EncounterNoteEditorModal
          open
          name={editingNote.name}
          body={editingNote.body}
          imageUrl={editingNote.imageUrl}
          visibility={editingNote.visibility}
          onClose={() => setEditingNote(null)}
          onSave={({ name, body, visibility }) => {
            const img = editingNote.imageUrl;
            applyOp({
              op: 'update-element',
              instanceId: editingNote.instanceId,
              updates: {
                name,
                body,
                visibility,
                ...(img ? { imageUrl: img } : {}),
              },
            });
            setEditingNote(null);
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
