/**
 * Bone domain — Swift Step (SRD level 10; Recall Cost 2)
 * SRD: daggerheart-srd/abilities/Swift Step.md
 *
 * When an attack made against you fails, clear a Stress. If you can't clear a Stress, gain a Hope.
 */

import { when, isTargeted } from '../../engine/when.js';

function attackAgainstMeFailed(table) {
  if (table.action?.type !== 'attack') return false;
  if (typeof table.rolls?.action?.isSuccess !== 'boolean') return false;
  return table.rolls.action.isSuccess === false;
}

export const SwiftStep = {
  name: 'Swift Step',
  description:
    'When an attack made against you fails, clear a Stress. If you can\'t clear a Stress, gain a Hope.',
  hooks: {
    onReviewAction: when(isTargeted, attackAgainstMeFailed, (table) => {
      if ((table.me.currentStress ?? 0) > 0) {
        table.me.clearStress(1);
      } else {
        table.me.gainHope(1);
      }
    }),
  },
};
