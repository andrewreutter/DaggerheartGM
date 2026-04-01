/**
 * Adversary HP/Stress “marked resource” rows — shared by GM map pin, player map pin, and player Encounter panel.
 */

import { getCheckboxTrackPreset } from './DetailCardContent.jsx';
import { isAdversaryDefeated } from '../lib/helpers.js';

export { playerEncounterInstanceRowVisible } from '../lib/encounter-adversary-player-summary.js';

/** Renders N filled (marked) slots with preset icon-in-border — player Encounter panel summary. */
export function MarkedBoxes({ count, trackKind }) {
  if (!count || count <= 0) return null;
  const preset = getCheckboxTrackPreset(trackKind);
  const { Icon } = preset;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="w-3 h-3 rounded-sm flex-shrink-0 inline-flex items-center justify-center bg-transparent border-0"
        >
          <Icon className={`w-2 h-2 ${preset.icon}`} strokeWidth={2.5} aria-hidden />
        </div>
      ))}
    </div>
  );
}

/**
 * One adversary instance row — **player** Encounter panel + **player** adversary map pin (no HP/Stress numeric line).
 * @param {object} displayEl — base adversary (hp_max, …)
 * @param {object} inst — table instance
 * @param {boolean} [showInstanceNum] — when multiple copies of this adversary exist
 * @param {number|null} [instanceNum] — 1-based index among copies
 */
export function EncounterAdversaryInstancePlayerSummary({ displayEl, inst, showInstanceNum = false, instanceNum = null }) {
  const hpMax = displayEl.hp_max || 0;
  const hpCur = inst.currentHp ?? hpMax;
  const hpDamage = hpMax - hpCur;
  const stressDamage = inst.currentStress || 0;
  const hasConditions = !!(
    inst.vulnerable ||
    (inst.conditions != null && String(inst.conditions).trim() !== '')
  );

  if (hpDamage <= 0 && stressDamage <= 0 && !hasConditions) return null;

  return (
    <div className="space-y-1">
      {showInstanceNum && instanceNum != null && (
        <span className="text-[10px] text-dh-muted font-medium">#{instanceNum}</span>
      )}
      {hpDamage > 0 && <MarkedBoxes count={hpDamage} trackKind="hp" />}
      {stressDamage > 0 && <MarkedBoxes count={stressDamage} trackKind="stress" />}
      {inst.vulnerable && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-950/50 border border-orange-700/60 text-orange-200">
          Vulnerable
        </span>
      )}
      {inst.focusedBy && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-900/50 border border-emerald-600/60 text-emerald-200">
          Focused by {inst.focusedBy}
        </span>
      )}
      {inst.difficultyMod != null && inst.difficultyMod !== 0 && (
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-900/60 border border-red-600/70 text-red-200"
          title="Difficulty modifier"
        >
          {inst.difficultyMod > 0 ? '+' : ''}
          {inst.difficultyMod} Difficulty
        </span>
      )}
      {isAdversaryDefeated({ hp_max: displayEl.hp_max, currentHp: inst.currentHp }) && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-dh-hover/80 border border-dh-strong text-dh">Defeated</span>
      )}
      {inst.conditions && (
        <p className="text-[10px] text-dh-muted italic ml-3.5">{inst.conditions}</p>
      )}
    </div>
  );
}

/**
 * @param {object} displayEl — base adversary data (hp_max, name, …)
 * @param {object} inst — table instance (currentHp, currentStress, conditions, …)
 * @param {boolean} [showInstanceNum]
 * @param {number|null} [instanceNum]
 * @param {'gm'|'player'} [audience] — `gm`: map pin / GM (numeric HP·Stress line). `player`: same marks/badges as player Encounter panel (no numeric line).
 */
export function EncounterAdversaryMarkedSummary({
  displayEl,
  inst,
  showInstanceNum = false,
  instanceNum = null,
  audience = 'gm',
}) {
  if (audience === 'player') {
    return (
      <EncounterAdversaryInstancePlayerSummary
        displayEl={displayEl}
        inst={inst}
        showInstanceNum={showInstanceNum}
        instanceNum={instanceNum}
      />
    );
  }

  const hpMax = displayEl.hp_max || 0;
  const stressMax = displayEl.stress_max || 0;
  const hpCur = inst.currentHp ?? hpMax;
  const stressCur = inst.currentStress ?? 0;
  const hpDamage = hpMax - hpCur;
  const stressDamage = stressCur;

  return (
    <div className="space-y-1.5">
      {showInstanceNum && instanceNum != null && (
        <span className="text-[10px] text-dh-muted font-medium">#{instanceNum}</span>
      )}
      <div className="text-[10px] text-dh-muted tabular-nums">
        HP {hpCur}/{hpMax} · Stress {stressCur}/{stressMax}
      </div>
      {hpDamage > 0 && <MarkedBoxes count={hpDamage} trackKind="hp" />}
      {stressDamage > 0 && <MarkedBoxes count={stressDamage} trackKind="stress" />}
      {inst.vulnerable && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-950/50 border border-orange-700/60 text-orange-200">
          Vulnerable
        </span>
      )}
      {inst.focusedBy && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-900/50 border border-emerald-600/60 text-emerald-200">
          Focused by {inst.focusedBy}
        </span>
      )}
      {inst.difficultyMod != null && inst.difficultyMod !== 0 && (
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-900/60 border border-red-600/70 text-red-200"
          title="Difficulty modifier"
        >
          {inst.difficultyMod > 0 ? '+' : ''}
          {inst.difficultyMod} Difficulty
        </span>
      )}
      {isAdversaryDefeated({ hp_max: displayEl.hp_max, currentHp: inst.currentHp }) && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-dh-hover/80 border border-dh-strong text-dh">Defeated</span>
      )}
      {inst.conditions && (
        <p className="text-[10px] text-dh-muted italic ml-0.5">{inst.conditions}</p>
      )}
    </div>
  );
}
