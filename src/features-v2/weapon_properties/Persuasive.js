import { when, isActing } from '../engine/when.js';

export const Persuasive = {
  name: 'Persuasive',
  description:
    'Before you make a Presence Roll, you can mark a Stress to gain a +2 bonus to the result.',
  chips: [
    when(
      isActing,
      (table) => table.action?.trait === 'Presence',
      {
        description: 'Mark a Stress to gain +2 to your Presence Roll.',
        placements: ['intent'],
        stressCost: 1,
        onUse(table) {
          table.rolls?.action?.addStatic({ name: 'Persuasive', value: 2 });
        },
      }
    ),
  ],
};
