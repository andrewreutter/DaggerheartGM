/**
 * SRD consumable — Sweet Moss (common roll table 56).
 * daggerheart-srd/consumables/Sweet Moss.md
 */

import { when } from '../engine/when.js';

function isRestAction(table) {
  const t = table.action?.type;
  return t === 'shortRest' || t === 'longRest';
}

function hpOrStressOptions() {
  return [
    {
      id: 'hp',
      name: 'Clear 1d10 HP',
      description: 'Roll d10 and clear that many HP.',
    },
    {
      id: 'stress',
      name: 'Clear 1d10 Stress',
      description: 'Roll d10 and clear that many Stress.',
    },
  ];
}

export const SweetMoss = {
  name: 'Sweet Moss',
  description: 'You can consume this moss during a rest to clear 1d10 HP or 1d10 Stress.',
  chips: [
    when(isRestAction, {
      name: 'Sweet Moss',
      placements: ['rest'],
      description:
        'Consume this moss during this rest: roll 1d10 and clear that much HP or Stress (choose one).',
      isSelect: hpOrStressOptions,
      onUse(table, chipState) {
        const id = chipState?.get?.('selectedId');
        if (id !== 'hp' && id !== 'stress') return;
        const n = table.rollDie('d10');
        if (id === 'hp') table.me.clearHP(n);
        else table.me.clearStress(n);
      },
    }),
  ],
};
