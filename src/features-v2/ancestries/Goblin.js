/**
 * Goblin Ancestry Features (V2)
 *
 * SRD source: daggerheart-srd/ancestries/Goblin.md
 */

import { when, isActing, isTargeted } from '../engine/when.js';

export const Surefooted = {
  name: 'Surefooted',
  description: 'You ignore disadvantage on Agility Rolls.',
  // Note: The V2 API doesn't have a declarative way to "ignore disadvantage".
  // This would require engine support to intercept disadvantage application
  // on Agility rolls. For now, this is a narrative feature that the GM
  // must manually apply, or it requires an engine extension.
  // Purely narrative implementation until engine supports disadvantage removal.
};

export const DangerSense = {
  name: 'Danger Sense',
  description:
    'Once per rest, mark a Stress to force an adversary to reroll an attack against you or an ally within Very Close range.',
  chips: [
    when(
      (table) => {
        // Available when there's an attack targeting me or an ally within Very Close
        if (!table.action || table.action.type !== 'attack') return false;
        if (!table.action.attacker?.isAdversary) return false;

        const targets = table.action.targets || [];
        const isTargetingMe = targets.some((t) => t.instanceId === table.me?.instanceId);
        const isTargetingAlly = targets.some(
          (t) =>
            t.isCharacter &&
            t.instanceId !== table.me?.instanceId &&
            table.me?.rangeFrom(t) === 'veryClose'
        );

        return isTargetingMe || isTargetingAlly;
      },
      {
        description:
          'Mark 1 Stress to force an adversary to reroll their attack against you or an ally within Very Close range.',
        placements: ['reviewOutcome'],
        frequency: 'rest',
        stressCost: 1,
        onUse(table) {
          // Force reroll of the attack
          // Note: The V2 API doesn't have a direct way to force an adversary
          // to reroll. This would require engine support to trigger a reroll
          // of the action roll. For now, this adds narration.
          table.action?.addNarration(
            'Danger Sense forces the adversary to reroll their attack.'
          );
          // The actual reroll would need to be handled by the engine
        },
      }
    ),
  ],
};
