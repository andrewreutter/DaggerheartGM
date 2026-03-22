/**
 * Arcana domain — Premonition (Tier 2)
 * SRD: Once per long rest, after consequences of your roll are conveyed, rescind and try another move.
 */

export const Premonition = {
  name: 'Premonition',
  description:
    'You can channel arcane energy to have visions of the future. Once per long rest, immediately after the GM conveys the consequences of a roll you made, you can rescind the move and consequences like they never happened and make another move instead.',
  chips: [
    {
      placements: ['card'],
      name: 'Premonition',
      frequency: 'longRest',
      description:
        'Once per long rest, immediately after the GM conveys the consequences of a roll you made: rescind that move and its consequences, then make another move instead (GM).',
      onUse(table) {
        table.me.actionLoop(
          'Premonition',
          'Once per long rest, immediately after the GM conveys the consequences of a roll you made, you may rescind the move and consequences as if they never happened, then make another move instead.'
        );
      },
    },
  ],
};
