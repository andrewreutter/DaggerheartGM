/**
 * SRD: Epic Aquatic Beast — daggerheart-srd/beastforms/Epic Aquatic Beast.md
 */

import {
  reduceIncomingHpByOneThreshold,
  revokeArmorCommitment,
} from '../engine/armor-review-outcome.js';
import { when, isActing, isTargeted, armorUseCommitted } from '../engine/when.js';

export const OceanMaster = {
  name: 'Ocean Master',
  description:
    'You can breathe and move naturally underwater. When you succeed on an attack against a target within Melee range, you can temporarily _Restrain_ them.',
  hooks: {
    onResolve: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      (table) => {
        const tgt = table.action?.target;
        return Boolean(tgt?.isAdversary && table.me.rangeFrom(tgt) === 'melee');
      },
      (table) => {
        table.action?.target?.addCondition('Restrained');
      }
    ),
  },
};

export const Unyielding = {
  name: 'Unyielding',
  description:
    'When you would mark an Armor Slot, roll a **d6.** On a result of 5 or higher, reduce the severity by one threshold without marking an Armor Slot.',
  hooks: {
    onReviewOutcome: when(
      isTargeted,
      armorUseCommitted,
      (table) => {
        const roll = table.rollDie('d6');
        if (roll < 5) return;
        reduceIncomingHpByOneThreshold(table);
        revokeArmorCommitment(table);
      }
    ),
  },
};

export const features = [OceanMaster, Unyielding];
