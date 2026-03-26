/**
 * Bone domain — I See It Coming (Tier 1)
 * SRD: When targeted by an attack from beyond Melee range, mark Stress to roll d4 and add to Evasion vs that attack.
 */

import { PENDING_EVASION_BONUS_STATE_KEY } from '../../../game-constants.js';
import { when, isTargeted } from '../../engine/when.js';

function attackFromBeyondMelee(table) {
  const a = table.action?.attacker;
  if (!a || !table.me) return false;
  if (table.action?.type !== 'attack') return false;
  const band = table.me.rangeFrom(a);
  if (band == null) return false;
  return band !== 'melee';
}

export const ISeeItComing = {
  name: 'I See It Coming',
  description:
    "When you're targeted by an attack made from beyond Melee range, you can **mark a Stress** to roll a **d4** and gain a bonus to your Evasion equal to the result against the attack.",
  chips: [
    when(
      isTargeted,
      attackFromBeyondMelee,
      {
        name: 'I See It Coming',
        placements: ['reviewAction'],
        stressCost: 1,
        description:
          'Mark 1 Stress: roll a d4 and add the result to your Evasion against this attack.',
        onUse(table) {
          const n = table.rollDie('d4');
          table.feature.set(PENDING_EVASION_BONUS_STATE_KEY, n);
        },
        temporaryStatMods: {
          evasion: (t) => t.feature.get(PENDING_EVASION_BONUS_STATE_KEY) ?? 0,
        },
      }
    ),
  ],
  hooks: {
    onReviewOutcome: when(
      isTargeted,
      (t) => t.action?.type === 'attack',
      (t) => {
        if ((t.feature.get(PENDING_EVASION_BONUS_STATE_KEY) ?? 0) > 0) {
          t.feature.set(PENDING_EVASION_BONUS_STATE_KEY, 0);
        }
      }
    ),
  },
};
