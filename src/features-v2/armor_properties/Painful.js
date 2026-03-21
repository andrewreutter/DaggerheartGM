import { when, isTargeted, armorUseCommitted } from '../engine/when.js';

export const Painful = {
  name: 'Painful',
  description: 'Each time you mark an Armor Slot, you must mark a Stress.',
  hooks: {
    onReviewOutcome: when(isTargeted, armorUseCommitted, (table) => {
      table.me.markStress(1);
    }),
  },
};
