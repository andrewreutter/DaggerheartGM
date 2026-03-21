import { when, isActing } from '../engine/when.js';

export const Quiet = {
  name: "Quiet",
  description: "You gain a +2 bonus to rolls you make to move silently.",
  chips: [
    when(isActing, {
      description: "Apply +2 bonus (rolling to move silently).",
      placements: ['intent'],
      onUse: (table) => {
        table.rolls?.action?.addStatic({ name: 'Quiet', value: 2 });
      },
    }),
  ],
};
