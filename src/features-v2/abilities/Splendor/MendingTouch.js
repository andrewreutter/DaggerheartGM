/**
 * Splendor domain — Mending Touch (Tier 1)
 * SRD: Spend 2 Hope to clear HP or Stress over a few minutes; once per long rest, clear 2 when roleplaying.
 */

export const MendingTouch = {
  name: 'Mending Touch',
  description:
    'You lay your hands upon a creature and channel healing magic to close their wounds. When you can take a few minutes to focus on the target you\'re helping, you can **spend 2 Hope** to clear a Hit Point or a Stress on them.\n\nOnce per long rest, when you spend this healing time learning something new about them or revealing something about yourself, you can clear 2 Hit Points or 2 Stress on them instead.',
  chips: [
    {
      placements: ['card'],
      name: 'Mending Touch',
      hopeCost: 2,
      description:
        'Spend 2 Hope. When you can take a few minutes to focus on the target: clear 1 Hit Point or 1 Stress on them.',
      onUse(table) {
        table.me.actionLoop(
          'Mending Touch',
          'Spend 2 Hope. When you can take a few minutes to focus on the target you are helping, clear 1 Hit Point or 1 Stress on them.'
        );
      },
    },
    {
      placements: ['card'],
      name: 'Mending Touch — Deeper Understanding',
      hopeCost: 2,
      frequency: 'longRest',
      description:
        'Once per long rest, when you spend this healing time (2 Hope) learning something new about them or revealing something about yourself, clear 2 Hit Points or 2 Stress on them instead.',
      onUse(table) {
        table.me.actionLoop(
          'Mending Touch — Deeper Understanding',
          'Once per long rest, when you spend this healing time learning something new about them or revealing something about yourself, clear 2 Hit Points or 2 Stress on them instead.'
        );
      },
    },
  ],
};
