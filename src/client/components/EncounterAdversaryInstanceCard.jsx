/**
 * Encounter-sidebar adversary instance body — shared by the Encounter panel and the
 * GM map-token pin so tracks, badges, and conditions stay in sync.
 */

import { useState } from 'react';
import { Tag, Trash2, X } from 'lucide-react';
import { isAdversaryDefeated } from '../lib/helpers.js';
import { normalizeConditionsToList } from '../lib/conditions-utils.js';
import { ROLE_BP_COST } from '../lib/constants.js';
import { CheckboxTrack } from './CheckboxTrack.jsx';
import { ConditionsEditor } from './ConditionsEditor.jsx';

/** Difficulty + damage-threshold chips — once per adversary type (above instance rows). */
export function EncounterAdversaryDifficultyRow({
  displayEl,
  className = 'flex items-center gap-1.5 flex-wrap px-2.5 pt-1.5',
}) {
  if (
    displayEl.difficulty == null
    && !(displayEl.hp_thresholds && (displayEl.hp_thresholds.major != null || displayEl.hp_thresholds.severe != null))
  ) {
    return null;
  }
  return (
    <div className={className}>
      {displayEl.difficulty != null && (
        <span className="text-[10px] font-bold text-cyan-400/70 bg-cyan-900/50 border border-cyan-800/50 rounded px-1">
          Diff {displayEl.difficulty}
        </span>
      )}
      {displayEl.hp_thresholds && (displayEl.hp_thresholds.major != null || displayEl.hp_thresholds.severe != null) && (
        <span className="text-[10px] text-dh-muted">
          Thresholds <span className="font-bold text-dh">{displayEl.hp_thresholds.major}</span>
          <span className="text-dh-muted"> / </span>
          <span className="font-bold text-red-300">{displayEl.hp_thresholds.severe}</span>
        </span>
      )}
    </div>
  );
}

/**
 * One adversary instance: Vulnerable/Focus/Difficulty badges, HP/Stress tracks, conditions.
 *
 * @param {object} displayEl — base adversary (hp_max, stress_max, role, …)
 * @param {object} inst — table instance (currentHp, currentStress, conditions, …)
 */
export function EncounterAdversaryInstanceCard({
  displayEl,
  inst,
  showInstanceNum = false,
  instanceNum = null,
  showBp = false,
  showInstanceRemove = false,
  onRemoveInstance,
  canEditTracks = true,
  updateFn,
  onSetHpFilled,
  onSetStressFilled,
  conditionsHistory = [],
  extraConditionSuggestions,
  onAddConditionsHistoryEntry,
  onRemoveConditionsHistoryEntry,
}) {
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const hpDamage = (displayEl.hp_max || 0) - (inst.currentHp ?? displayEl.hp_max ?? 0);
  const hasConditions = normalizeConditionsToList(inst.conditions).length > 0;
  const showConditionsEditor = hasConditions || conditionsOpen;
  const trackInteractive = canEditTracks && (typeof updateFn === 'function' || typeof onSetHpFilled === 'function' || typeof onSetStressFilled === 'function');

  const setHp = trackInteractive
    ? (dmg) => {
        if (typeof onSetHpFilled === 'function') onSetHpFilled(dmg);
        else updateFn(inst.instanceId, { currentHp: (displayEl.hp_max || 0) - dmg });
      }
    : undefined;
  const setStress = trackInteractive
    ? (s) => {
        if (typeof onSetStressFilled === 'function') onSetStressFilled(s);
        else updateFn(inst.instanceId, { currentStress: s });
      }
    : undefined;
  const patch = typeof updateFn === 'function'
    ? (updates) => updateFn(inst.instanceId, updates)
    : null;

  return (
    <div className="space-y-1 rounded group/inst">
      {(showInstanceNum || showBp) && (
        <div className="flex items-center gap-1.5 text-[10px] text-dh-muted">
          {showInstanceNum && instanceNum != null && (
            <span className="text-dh-muted font-medium">#{instanceNum}</span>
          )}
          {showBp && (
            <>
              {showInstanceNum && <span className="text-dh-muted">·</span>}
              <span className="capitalize">{displayEl.role || 'Standard'}</span>
              <span className="text-dh-muted">·</span>
              {displayEl.role === 'minion'
                ? <span>1/group BP</span>
                : <span className="text-dh-muted tabular-nums">{ROLE_BP_COST[displayEl.role || 'standard'] ?? ROLE_BP_COST.standard} BP</span>
              }
            </>
          )}
          {showInstanceRemove && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemoveInstance?.(inst.instanceId); }}
              className="ml-auto hidden group-hover/inst:flex w-4 h-4 rounded bg-dh-raised hover:bg-red-900 text-dh-muted hover:text-red-300 items-center justify-center transition-colors leading-none shrink-0"
              title={instanceNum != null ? `Remove #${instanceNum}` : 'Remove'}
            ><Trash2 size={9} /></button>
          )}
        </div>
      )}
      {inst.vulnerable && (
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-950/50 border border-orange-700/60 text-orange-200">Vulnerable</span>
          {patch && (
            <button
              type="button"
              onClick={() => patch({ vulnerable: false })}
              className="p-0.5 rounded text-dh-muted hover:text-dh hover:bg-dh-hover transition-colors"
              title="Clear Vulnerable"
            >
              <X size={10} />
            </button>
          )}
        </div>
      )}
      {inst.focusedBy && (
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-900/50 border border-emerald-600/60 text-emerald-200">Focused by {inst.focusedBy}</span>
          {patch && (
            <button
              type="button"
              onClick={() => patch({ focusedBy: null })}
              className="p-0.5 rounded text-dh-muted hover:text-dh hover:bg-dh-hover transition-colors"
              title="Clear Focus"
            >
              <X size={10} />
            </button>
          )}
        </div>
      )}
      {inst.difficultyMod != null && inst.difficultyMod !== 0 && (
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-900/60 border border-red-600/70 text-red-200" title="Difficulty modifier">
            {inst.difficultyMod > 0 ? '+' : ''}{inst.difficultyMod} Difficulty
          </span>
          {patch && (
            <button
              type="button"
              onClick={() => patch({ difficultyMod: 0 })}
              className="p-0.5 rounded text-dh-muted hover:text-dh hover:bg-dh-hover transition-colors"
              title="Clear difficulty modifier"
            >
              <X size={10} />
            </button>
          )}
        </div>
      )}
      {isAdversaryDefeated({ hp_max: displayEl.hp_max, currentHp: inst.currentHp }) && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-dh-hover/80 border border-dh-strong text-dh">Defeated</span>
      )}
      {(displayEl.hp_max || 0) > 0 && (
        <div className="flex items-center gap-1">
          <CheckboxTrack
            total={displayEl.hp_max || 0}
            filled={hpDamage}
            onSetFilled={setHp}
            trackKind="hp"
            label="HP"
            verbs={['Mark', 'Clear']}
          />
          {(displayEl.stress_max || 0) === 0 && !showConditionsEditor && (
            <button
              type="button"
              onClick={() => setConditionsOpen(true)}
              className="ml-1 text-dh-muted hover:text-dh transition-colors shrink-0"
              title="Add conditions"
            ><Tag size={10} /></button>
          )}
        </div>
      )}
      {(displayEl.stress_max || 0) > 0 && (
        <div className="flex items-center gap-1">
          <CheckboxTrack
            total={displayEl.stress_max || 0}
            filled={inst.currentStress || 0}
            onSetFilled={setStress}
            trackKind="stress"
            label="Stress"
            verbs={['Mark', 'Clear']}
          />
          {!showConditionsEditor && (
            <button
              type="button"
              onClick={() => setConditionsOpen(true)}
              className="ml-1 text-dh-muted hover:text-dh transition-colors shrink-0"
              title="Add conditions"
            ><Tag size={10} /></button>
          )}
        </div>
      )}
      {showConditionsEditor && (
        <ConditionsEditor
          instanceId={inst.instanceId}
          placeholder="Add condition…"
          autoFocus={conditionsOpen && !hasConditions}
          value={inst.conditions || ''}
          onCommit={(v) => patch?.({ conditions: v })}
          suggestions={conditionsHistory}
          extraSuggestions={extraConditionSuggestions}
          onAddSuggestion={onAddConditionsHistoryEntry}
          onRemoveSuggestion={onRemoveConditionsHistoryEntry}
          onBlur={() => {
            if (!hasConditions) setConditionsOpen(false);
          }}
          className="w-full flex flex-wrap items-center gap-1 bg-dh-raised/50 border border-dh-strong rounded px-1.5 py-0.5 text-xs text-dh focus-within:border-blue-500"
        />
      )}
    </div>
  );
}
