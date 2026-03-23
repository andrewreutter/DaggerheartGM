/**
 * Bone domain — On the Brink (Tier 3)
 * SRD: When you have 2 or fewer Hit Points unmarked, you don't take Minor damage.
 */

import { when, isTargeted, youTakeMinorDamage, isMinorPendingHpLossEffect } from '../../engine/when.js';

function isOnTheBrink(table) {
  return (table.me?.currentHP ?? 0) <= 2;
}

export const OnTheBrink = {
  name: 'On the Brink',
  description:
    'When you have 2 or fewer Hit Points unmarked, you don\'t take Minor damage.',
  hooks: {
    onReviewOutcome: when(
      isTargeted,
      isOnTheBrink,
      youTakeMinorDamage,
      (table) => {
        const id = table.me?.instanceId;
        const hp = (table.action?.effects ?? []).find(
          (e) =>
            e.stat === 'currentHP' &&
            e.target?.instanceId === id &&
            isMinorPendingHpLossEffect(e)
        );
        if (hp) hp.amount = 0;
      }
    ),
  },
};
