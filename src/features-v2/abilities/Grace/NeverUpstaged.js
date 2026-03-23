/**
 * Grace domain — Never Upstaged (Tier 2 / level 6)
 * SRD: When you mark 1+ HP from an attack, you may mark 1 Stress to bank tokens equal to HP marked.
 * On your next successful attack, +5 damage per token, then clear tokens.
 */

import { when, isActing } from '../../engine/when.js';

/** Hit Points you are about to mark on yourself from someone else's attack. */
function hpMarkedOnMeFromAttack(table) {
  if (table.action?.type !== 'attack') return 0;
  const me = table.me?.instanceId;
  const actor = table.action?.actor?.instanceId;
  if (!me || !actor || actor === me) return 0;
  let hpMarkSum = 0;
  let damageOnlySum = 0;
  for (const e of table.action?.effects ?? []) {
    if (!(e.amount > 0) || e.target?.instanceId !== me) continue;
    if (e.stat === 'currentHP') hpMarkSum += e.amount;
    if (e.type === 'damage') damageOnlySum += e.amount;
  }
  // Prefer resolved HP loss (post-threshold); VTT may send only `type: 'damage'` (see Sheltering.js).
  return hpMarkSum > 0 ? hpMarkSum : damageOnlySum;
}

function hasBankTrigger(table) {
  return hpMarkedOnMeFromAttack(table) > 0;
}

function hasSpentTokens(table) {
  return (table.feature.get('neverUpstagedTokens') ?? 0) > 0;
}

function attackSucceeded(table) {
  return table.rolls?.action?.isSuccess === true;
}

export const NeverUpstaged = {
  name: 'Never Upstaged',
  description:
    'When you mark 1 or more Hit Points from an attack, you can **mark a Stress** to place a number of tokens equal to the number of Hit Points you marked on this card. On your next successful attack, gain a +5 bonus to your damage roll for each token on this card, then clear all tokens.',
  chips: [
    when(hasBankTrigger, {
      name: 'Never Upstaged',
      placements: ['reviewOutcome'],
      description:
        'Mark 1 Stress to place tokens equal to the Hit Points you marked from this attack (+5 damage per token on your next successful attack; then clear).',
      onUse(table) {
        const n = hpMarkedOnMeFromAttack(table);
        table.me.markStress(1);
        const cur = table.feature.get('neverUpstagedTokens') ?? 0;
        table.feature.set('neverUpstagedTokens', cur + n);
      },
    }),
  ],
  hooks: {
    onReviewAction: when(
      isActing,
      (t) => t.action?.type === 'attack',
      attackSucceeded,
      hasSpentTokens,
      (table) => {
        const n = table.feature.get('neverUpstagedTokens') ?? 0;
        if (table.rolls?.damage) {
          table.rolls.damage.addStatic({ name: 'Never Upstaged', value: 5 * n });
        }
        table.feature.set('neverUpstagedTokens', 0);
      }
    ),
  },
};
