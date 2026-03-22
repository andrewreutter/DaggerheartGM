import { when, isActing } from '../engine/when.js';

export const DoubleDuty = {
  name: 'Double Duty',
  description: '+1 to Armor Score; +1 to primary weapon damage within Melee range.',
  passiveStatMods: {
    armorScore: 1,
  },
  hooks: {
    onIntent: when(
      isActing,
      (table) => table.action?.type === 'attack' && table.action?.range === 'melee',
      (table) => {
        table.rolls?.damage?.addStatic({ name: 'Double Duty', value: 1 });
      }
    ),
  },
};
