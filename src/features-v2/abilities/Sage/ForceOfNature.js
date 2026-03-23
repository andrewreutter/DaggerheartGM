/**
 * Sage domain — Force of Nature (Tier 3 / level 10 spell)
 * SRD: daggerheart-srd/abilities/Force of Nature.md
 */

import { when, isActing } from '../../engine/when.js';

function forceOfNatureActive(table) {
  return table.feature.get('forceOfNatureActive') === true;
}

function hasActionRoll(table) {
  return table.rolls?.action != null;
}

/** Daggerheart “within Close range” — Melee, Very Close, or Close (≤30'). */
function withinCloseRangeBand(table) {
  const tgt = table.action?.target;
  if (!tgt) return false;
  const band = table.me.rangeFrom(tgt);
  return band === 'melee' || band === 'veryClose' || band === 'close';
}

function totalHpLossToTarget(table, tid) {
  let sum = 0;
  for (const pool of [table.action?.effects ?? [], table.action?.appliedEffects ?? []]) {
    for (const e of pool) {
      if (e.target?.instanceId !== tid) continue;
      if (e.stat === 'currentHP') sum += e.amount ?? 0;
      if (e.type === 'damage') sum += e.amount ?? 0;
    }
  }
  return sum;
}

function attackOrSpellcastSuccessWithDamage(table) {
  if (table.rolls?.action?.isSuccess !== true) return false;
  if (table.rolls?.damage == null) return false;
  const t = table.action?.type;
  return t === 'attack' || t === 'spellcast';
}

function defeatAbsorbEligible(table) {
  if (table.rolls?.action?.isSuccess !== true) return false;
  const act = table.action?.type;
  if (act !== 'attack' && act !== 'spellcast') return false;
  if (!withinCloseRangeBand(table)) return false;
  const tid = table.action?.target?.instanceId;
  if (!tid) return false;
  const tgt = table.actors.find((a) => a.instanceId === tid);
  if (!tgt) return false;
  const cur = tgt.currentHP ?? 0;
  if (cur < 1) return false;
  return totalHpLossToTarget(table, tid) >= cur;
}

function batchAddsRestrainedToMe(table) {
  return (table.mutationBatch || []).some(
    (m) =>
      m.type === 'addCondition' &&
      m.payload?.instanceId === table.me?.instanceId &&
      m.payload?.condition === 'Restrained'
  );
}

export const ForceOfNature = {
  name: 'Force of Nature',
  description:
    '**Mark a Stress** to transform into a hulking nature spirit, gaining the following benefits:\n\n- When you succeed on an attack or Spellcast Roll, gain a +10 bonus to the damage roll.\n- When you deal enough damage to defeat a creature within Close range, you absorb them and clear an Armor Slot.\n- You can\'t be _Restrained_.\n\nBefore you make an action roll, you must **spend a Hope**. If you can\'t, you revert to your normal form.',
  stressCost: 1,
  onUse(table) {
    table.feature.set('forceOfNatureActive', true);
    table.me.actionLoop(
      'Force of Nature',
      'You transform into a hulking nature spirit. Before each action roll, spend 1 Hope or revert. On a successful attack or spellcast with a damage roll, +10 to damage. Defeating a creature within Close range clears an Armor Slot. You cannot be Restrained.'
    );
  },
  hooks: {
    onIntent: when(isActing, forceOfNatureActive, hasActionRoll, (table) => {
      if ((table.me.hope ?? 0) >= 1) {
        table.me.spendHope(1);
      } else {
        table.feature.set('forceOfNatureActive', false);
      }
    }),
    onReviewAction: when(
      isActing,
      forceOfNatureActive,
      attackOrSpellcastSuccessWithDamage,
      (table) => {
        table.rolls.damage.addStatic({ name: 'Force of Nature', value: 10 });
      }
    ),
    onResolve: when(isActing, forceOfNatureActive, defeatAbsorbEligible, (table) => table.me.clearArmor(1)),
    onStateChange: when(
      forceOfNatureActive,
      batchAddsRestrainedToMe,
      (table) => table.me.removeCondition('Restrained')
    ),
  },
};
