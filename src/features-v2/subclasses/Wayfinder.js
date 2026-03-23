/**
 * Wayfinder Ranger subclass — SRD: daggerheart-srd/subclasses/Wayfinder.md
 */

import { when, isActing, isTargeted, youDealSevereDamage } from '../engine/when.js';
import { queueInternalMutation } from '../engine/table.js';

/** True when the acting attacker is the Ranger's current Focus adversary. */
function focusIsAttackingMe(table) {
  const actor = table.action?.actor;
  const fid = table.me?.focusTargetInstanceId;
  return (
    actor?.isAdversary === true &&
    fid != null &&
    actor?.instanceId != null &&
    actor.instanceId === fid
  );
}

export const RuthlessPredator = {
  name: 'Ruthless Predator',
  description:
    'When you make a damage roll, you can mark a Stress to gain a +1 bonus to your Proficiency. Additionally, when you deal Severe damage to an adversary, they must mark a Stress.',
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.damage != null,
      {
        description:
          'Mark 1 Stress to gain +1 to your Proficiency on this damage roll (adds +1 to damage).',
        placements: ['reviewAction'],
        stressCost: 1,
        onUse(table) {
          table.rolls?.damage?.addStatic?.({ name: 'Ruthless Predator', value: 1 });
        },
      }
    ),
  ],
  hooks: {
    onReviewOutcome: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.action?.target?.isAdversary === true && youDealSevereDamage(table),
      (table) => {
        table.action?.target?.markStress(1);
      }
    ),
  },
};

export const PathForward = {
  name: 'Path Forward',
  description:
    "When you're traveling to a place you've previously visited or you carry an object that has been at the location before, you can identify the shortest, most direct path to your destination.",
};

export const ElusivePredator = {
  name: 'Elusive Predator',
  description:
    "When your Focus makes an attack against you, you gain a +2 bonus to your Evasion against the attack.",
  hooks: {
    onIntent: when(
      isTargeted,
      (table) => table.action?.type === 'attack',
      focusIsAttackingMe,
      (table) => {
        queueInternalMutation(table, 'addTemporaryStatMod', {
          instanceId: table.me.instanceId,
          stat: 'evasion',
          value: 2,
        });
      }
    ),
  },
};

export const ApexPredator = {
  name: 'Apex Predator',
  description:
    'Before you make an attack roll against your Focus, you can spend a Hope. On a successful attack, you remove a Fear from the GM Fear pool.',
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => {
        const tid = table.action?.target?.instanceId;
        const fid = table.me?.focusTargetInstanceId;
        return tid != null && fid != null && tid === fid;
      },
      {
        placements: ['intent'],
        hopeCost: 1,
        description:
          'Spend 1 Hope before this attack vs your Focus. On a successful attack, remove 1 Fear from the GM Fear pool.',
        onUse(table) {
          table.feature.set('apexPredatorArmed', true);
        },
      }
    ),
  ],
  hooks: {
    onReviewAction: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.feature.get('apexPredatorArmed') === true,
      (table) => {
        table.feature.set('apexPredatorArmed', false);
        if (table.rolls?.action?.isSuccess) {
          table.top.spendFear(1);
        }
      }
    ),
  },
};
