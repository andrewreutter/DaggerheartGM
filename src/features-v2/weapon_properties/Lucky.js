import { when, isActing } from '../engine/when.js';

export const Lucky = {
  name: 'Lucky',
  description: 'On a failed attack, you can mark a Stress to reroll your attack.',
  hooks: {
    onIntent: when(isActing, (table) => table.action?.type === 'attack', (table) => {
      table.feature.set('luckySpentThisAttack', false);
    }),
  },
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === false,
      {
        name: 'Lucky reroll',
        description: 'Mark a Stress to reroll your Hope and Fear dice.',
        placements: ['reviewAction'],
        stressCost: 1,
        isDisabled(table) {
          if (!!table.feature.get('luckySpentThisAttack')) return 'Lucky reroll already used this attack.';
          if (table.rolls?.action?.isSuccess !== false) return 'Lucky only applies when the attack failed.';
          return false;
        },
        onUse(table) {
          table.feature.set('luckySpentThisAttack', true);
          table.rolls?.action?.hopeDie?.reroll();
          table.rolls?.action?.fearDie?.reroll();
        },
      }
    ),
  ],
};
