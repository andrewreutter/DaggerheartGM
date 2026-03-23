import { when, isActing } from '../engine/when.js';

const isAttackSuccess = (table) =>
  table.action?.type === 'attack' && table.rolls?.action?.isSuccess === true;

const lifestealChipsDisabled = (table) => {
  if (table.feature.get('lifestealUsed') === true) return 'Lifestealing already used on this attack.';
  if (table.feature.get('lifestealD6') !== 6) return 'Roll a 6 on the Lifestealing d6 first.';
  return false;
};

export const Lifestealing = {
  name: 'Lifestealing',
  description:
    'On a successful attack, roll a d6. On a result of 6, clear a Hit Point or clear a Stress.',
  hooks: {
    onReviewAction: when(isActing, isAttackSuccess, (table) => {
      table.feature.set('lifestealUsed', false);
      const total = table.rollDie('d6');
      table.feature.set('lifestealD6', total);
    }),
  },
  chips: [
    when(
      isActing,
      isAttackSuccess,
      {
        name: 'Lifestealing — Clear Hit Point',
        description: 'Clear 1 marked Hit Point on yourself.',
        placements: ['resolveAction'],
        isDisabled: lifestealChipsDisabled,
        onUse: (table) => {
          table.feature.set('lifestealUsed', true);
          table.me.clearHP(1);
        },
      }
    ),
    when(
      isActing,
      isAttackSuccess,
      {
        name: 'Lifestealing — Clear Stress',
        description: 'Clear 1 Stress on yourself.',
        placements: ['resolveAction'],
        isDisabled: lifestealChipsDisabled,
        onUse: (table) => {
          table.feature.set('lifestealUsed', true);
          table.me.clearStress(1);
        },
      }
    ),
  ],
};
