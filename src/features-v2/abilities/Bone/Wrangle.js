/**
 * Bone domain — Wrangle (SRD level 8; Recall Cost 1)
 * SRD: daggerheart-srd/abilities/Wrangle.md
 */

export const Wrangle = {
  name: 'Wrangle',
  description:
    '**Recall Cost 1.** Make an Agility Roll against all targets within Close range. **Spend a Hope** to move targets you succeed against, and any willing allies within Close range, to another point within Close range.',
  chips: [
    {
      placements: ['card'],
      name: 'Wrangle',
      hopeCost: 1,
      description:
        'Spend 1 Hope (recall). Make an Agility roll against all targets within Close range, then move each target you succeed against plus any willing allies within Close range together to another point within Close range (GM adjudicates the roll and token positions).',
      onUse(table) {
        table.me.actionLoop(
          'Wrangle',
          'Spend 1 Hope. Make an Agility roll against all targets within Close range. Move each target you succeed against, and any willing allies within Close range, together to another point within Close range (GM adjudicates the roll and places tokens).',
          { trait: 'Agility' }
        );
      },
    },
  ],
};
