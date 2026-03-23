/**
 * Valor domain — Rise Up (Tier 2 / level 6)
 * SRD: Gain a bonus to your Severe threshold equal to your Proficiency.
 * When you mark 1+ HP from an attack, clear a Stress.
 */

import { when, isTargeted } from '../../engine/when.js';

/** HP you marked on yourself from another creature's attack (Resolve uses appliedEffects when present). */
function hpMarkedOnMeFromAttack(table) {
  if (table.action?.type !== 'attack') return 0;
  const me = table.me?.instanceId;
  const actor = table.action?.actor?.instanceId;
  if (!me || !actor || actor === me) return 0;
  const primary =
    (table.action?.appliedEffects?.length ? table.action.appliedEffects : table.action?.effects) ?? [];
  let hpMarkSum = 0;
  let damageOnlySum = 0;
  for (const e of primary) {
    if (!(e.amount > 0) || e.target?.instanceId !== me) continue;
    if (e.stat === 'currentHP') hpMarkSum += e.amount;
    if (e.type === 'damage') damageOnlySum += e.amount;
  }
  return hpMarkSum > 0 ? hpMarkSum : damageOnlySum;
}

function shouldClearStressFromAttack(table) {
  return hpMarkedOnMeFromAttack(table) > 0;
}

export const RiseUp = {
  name: 'Rise Up',
  description:
    'Gain a bonus to your Severe threshold equal to your Proficiency.\n\nWhen you mark 1 or more Hit Points from an attack, clear a Stress.',
  passiveStatMods: {
    severeThreshold: (table) => table.me?.proficiency ?? 1,
  },
  hooks: {
    onResolve: when(
      isTargeted,
      (t) => t.action?.type === 'attack',
      (t) => (t.me?.currentStress ?? 0) > 0,
      shouldClearStressFromAttack,
      (table) => {
        table.me.clearStress(1);
      }
    ),
  },
};
