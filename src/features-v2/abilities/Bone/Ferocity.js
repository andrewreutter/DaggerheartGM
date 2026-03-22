/**
 * Bone domain — Ferocity (Tier 1)
 * SRD: When you cause an adversary to mark 1+ HP, you can spend 2 Hope to increase your Evasion
 * by the number of HP they marked until after the next attack made against you.
 */

import { when, isActing, isTargeted } from '../../engine/when.js';

function hpMarkedOnAdversary(table) {
  const me = table.me?.instanceId;
  if (!me || table.action?.actor?.instanceId !== me) return 0;
  let sum = 0;
  for (const e of table.action?.effects ?? []) {
    if (e.stat !== 'currentHP' || !(e.amount > 0)) continue;
    const t = e.target;
    if (!t || !(t.isAdversary === true || t.elementType === 'adversary')) continue;
    sum += e.amount;
  }
  return sum;
}

function hasFerocityTrigger(table) {
  return hpMarkedOnAdversary(table) > 0;
}

export const Ferocity = {
  name: 'Ferocity',
  description:
    'When you cause an adversary to mark 1 or more Hit Points, you can spend 2 Hope to increase your Evasion by the number of Hit Points they marked. This bonus lasts until after the next attack made against you.',
  passiveStatMods: when(
    (t) => (t.feature.get('ferocityEvasionBonus') ?? 0) > 0,
    {
      evasion: (table) => table.feature.get('ferocityEvasionBonus') ?? 0,
    }
  ),
  chips: [
    when(
      isActing,
      hasFerocityTrigger,
      {
        name: 'Ferocity',
        placements: ['reviewOutcome'],
        hopeCost: 2,
        description:
          'Spend 2 Hope: gain +Evasion equal to the HP the adversary marked this hit until after the next attack against you.',
        onUse(table) {
          const n = hpMarkedOnAdversary(table);
          if (n > 0) {
            table.feature.set('ferocityEvasionBonus', n);
          }
        },
      }
    ),
  ],
  hooks: {
    onReviewOutcome: when(
      isTargeted,
      (t) => t.action?.type === 'attack',
      (t) => {
        if ((t.feature.get('ferocityEvasionBonus') ?? 0) > 0) {
          t.feature.set('ferocityEvasionBonus', 0);
        }
      }
    ),
  },
};
