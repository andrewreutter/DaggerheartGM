/**
 * Firbolg Ancestry Features (V2)
 *
 * SRD source: daggerheart-srd/ancestries/Firbolg.md
 */

import { when, isActing } from '../engine/when.js';

export const Charge = {
  name: 'Charge',
  description:
    'When you succeed on an Agility Roll to move from Far or Very Far range into Melee range with one or more targets, you can mark a Stress to deal 1d12 physical damage to all targets within Melee range.',
  chips: [
    when(
      isActing,
      (table) => {
        const meleeAdvs = table.adversaries.filter(
          (a) => table.me.rangeFrom(a) === 'melee'
        );
        return (
          table.action?.type === 'trait' &&
          table.action?.trait === 'Agility' &&
          table.rolls?.action?.isSuccess === true &&
          meleeAdvs.length > 0 &&
          meleeAdvs.some((a) => {
            const last = table.me.lastPosition?.rangeFrom(a);
            return last === 'far' || last === 'veryFar';
          })
        );
      },
      {
        description:
          'Mark 1 Stress to deal 1d12 physical damage to all targets within Melee range.',
        placements: ['reviewAction'],
        stressCost: 1,
        onUse(table) {
          const meleeTargets = table.adversaries.filter(
            (a) => table.me.rangeFrom(a) === 'melee'
          );
          table.action?.addDamageRoll({
            name: 'Charge',
            dice: '1d12',
            damageType: 'physical',
            targets: meleeTargets,
          });
        },
      }
    ),
  ],
};

export const Unshakable = {
  name: 'Unshakable',
  description:
    "When you would mark a Stress, roll a d6. On a result of 6, don't mark it.",
  hooks: {
    onReviewOutcome(table) {
      const stressEffect = table.action?.effects?.find(
        (e) =>
          e.stat === 'currentStress' &&
          e.target?.instanceId === table.me?.instanceId &&
          e.amount > 0
      );
      if (!stressEffect) return;
      const roll = table.rollDie('d6');
      if (roll === 6) {
        stressEffect.amount = 0;
      }
    },
  },
};
