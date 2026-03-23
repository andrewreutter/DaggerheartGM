/**
 * Bone domain — Recovery (Tier 3, level 6)
 * SRD: During a short rest, you can choose a long rest downtime move instead.
 * You can spend a Hope to let an ally do the same.
 */

export const Recovery = {
  name: 'Recovery',
  description:
    'During a short rest, you can choose a long rest downtime move instead. You can **spend a Hope** to let an ally do the same.',
  passiveStatMods: {
    numLongMovesInShortRest: 1,
  },
  chips: [
    {
      placements: ['card'],
      name: 'Recovery — Ally',
      hopeCost: 1,
      description:
        'During this short rest, spend 1 Hope so one ally may also choose a long rest downtime move for one of their short rest choices (GM applies).',
      onUse(table) {
        table.me.actionLoop(
          'Recovery',
          'Spend 1 Hope: one ally may choose a long rest downtime move as one of their short rest choices this rest (GM tracks which ally and which slot).'
        );
      },
    },
  ],
};
