import { when, isActing } from '../engine/when.js';

export const Persuasive = {
  name: 'Persuasive',
  description:
    'Before you make a Presence Roll, you can mark a Stress to gain a +2 bonus to the result.',
  chips: [
    when(
      isActing,
      (table) =>
        table.action?.type === 'trait' && String(table.action?.trait ?? '').toLowerCase() === 'presence',
      {
        name: 'Persuasive bonus',
        description: 'Mark a Stress to gain +2 to this Presence roll.',
        placements: ['intent'],
        stressCost: 1,
        onUse(table) {
          table.rolls?.action?.addStatic({ name: 'Persuasive', value: 2 });
        },
      }
    ),
  ],
};
