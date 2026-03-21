import { when, isTargeted } from '../engine/when.js';

export const Burning = {
  name: "Burning",
  description: "When an adversary attacks you within Melee range, they mark a Stress.",
  hooks: {
    onReviewAction: when(
      isTargeted,
      (table) =>
        table.action?.type === 'attack' && table.action?.range === 'melee',
      (table) => table.action?.actor?.isAdversary === true,
      (table) => {
        table.action.actor.markStress(1);
      }
    ),
  },
};
