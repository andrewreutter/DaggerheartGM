/**
 * Goblin Ancestry Features (V2)
 *
 * SRD source: daggerheart-srd/ancestries/Goblin.md
 */

import { when, isActing, isTargeted } from '../engine/when.js';

export const Surefooted = {
  name: 'Surefooted',
  description: 'You ignore disadvantage on Agility Rolls.',
  hooks: {
    onIntent: when(
      (table) => table.action?.trait === 'Agility',
      (table) => {
        (table.rolls?.action?.disadvantageDice ?? []).forEach((dd) => {
          table.rolls?.action?.removeDisadvantageDie(dd.name);
        });
      }
    ),
  },
};

export const DangerSense = {
  name: 'Danger Sense',
  description:
    'Once per rest, mark a Stress to force an adversary to reroll an attack against you or an ally within Very Close range.',
  chips: [
    when(
      (table) => table.action?.type === 'attack',
      (table) => table.action?.actor?.isAdversary === true,
      (table) => {
        const targets = table.action.targets || [];
        const isTargetingMe = targets.some((t) => t.instanceId === table.me?.instanceId);
        const isTargetingAlly = targets.some(
          (t) =>
            t.isCharacter &&
            t.instanceId !== table.me?.instanceId &&
            (table.me?.rangeFrom(t) === 'melee' || table.me?.rangeFrom(t) === 'veryClose')
        );

        return isTargetingMe || isTargetingAlly;
      },
      {
        description:
          'Mark 1 Stress to force an adversary to reroll their attack against you or an ally within Very Close range.',
        placements: ['reviewAction'],
        frequency: 'rest',
        stressCost: 1,
        onUse(table) {
          table.rolls?.action?.hopeDie?.reroll();
          table.rolls?.action?.fearDie?.reroll();
        },
      }
    ),
  ],
};
