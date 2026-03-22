import {
  reduceIncomingHpByOneThreshold,
  revokeArmorCommitment,
} from '../engine/armor-review-outcome.js';
import { when, isTargeted, armorUseCommitted } from '../engine/when.js';

/** True when the wearer has exactly one unmarked armor slot (this use would mark the last). */
function wouldMarkLastArmorSlot(table) {
  return (table.me?.armor ?? 0) === 1;
}

export const Resilient = {
  name: 'Resilient',
  description:
    'Before you mark your last Armor Slot, roll a d6. On a result of 6, reduce the severity by one threshold without marking an Armor Slot.',
  hooks: {
    onReviewOutcome: when(
      isTargeted,
      armorUseCommitted,
      wouldMarkLastArmorSlot,
      (table) => {
        const roll = table.rollDie('d6');
        if (roll !== 6) return;
        reduceIncomingHpByOneThreshold(table);
        revokeArmorCommitment(table);
      }
    ),
  },
};
