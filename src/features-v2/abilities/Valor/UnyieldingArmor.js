/**
 * Valor domain — Unyielding Armor (Level 10; Recall Cost 1)
 * SRD: daggerheart-srd/abilities/Unyielding Armor.md
 *
 * When you would mark an Armor Slot, roll a number of **d6s** equal to your Proficiency.
 * If any roll a 6, reduce the severity by one threshold without marking an Armor Slot.
 */

import {
  reduceIncomingHpByOneThreshold,
  revokeArmorCommitment,
} from '../../engine/armor-review-outcome.js';
import { when, isTargeted, armorUseCommitted } from '../../engine/when.js';

export const UnyieldingArmor = {
  name: 'Unyielding Armor',
  description:
    'When you would mark an Armor Slot, roll a number of **d6s** equal to your Proficiency. If any roll a 6, reduce the severity by one threshold without marking an Armor Slot.',
  hooks: {
    onReviewOutcome: when(
      isTargeted,
      armorUseCommitted,
      (table) => {
        const prof = Math.max(0, Math.floor(Number(table.me.proficiency ?? 1)));
        let anySix = false;
        for (let i = 0; i < prof; i++) {
          if (table.rollDie('d6') === 6) anySix = true;
        }
        if (!anySix) return;
        reduceIncomingHpByOneThreshold(table);
        revokeArmorCommitment(table);
      }
    ),
  },
};
