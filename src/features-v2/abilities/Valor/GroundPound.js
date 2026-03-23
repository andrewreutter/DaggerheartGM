/**
 * Valor domain — Ground Pound (Level 8; Recall Cost 2)
 * SRD: daggerheart-srd/abilities/Ground Pound.md
 */

export const GroundPound = {
  name: 'Ground Pound',
  description:
    '**Recall Cost 2.** **Spend 2 Hope** to strike the ground where you stand and make a **Strength Roll** against all targets within Very Close range. Targets you succeed against are thrown back to Far range and must make a Reaction Roll (17). Targets who fail take **4d10+8** damage. Targets who succeed take half damage.',
  chips: [
    {
      placements: ['card'],
      name: 'Ground Pound',
      hopeCost: 2,
      description:
        'Spend 2 Hope (recall). Strength roll vs all targets within Very Close range. Targets you beat are thrown to Far and make Reaction Rolls (17): 4d10+8 on failure, half damage on success.',
      onUse(table) {
        table.me.actionLoop(
          'Ground Pound',
          'Spend 2 Hope (recall). Strike the ground where you stand and make a Strength roll against all targets within Very Close range. Targets you succeed against are thrown back to Far range and must make a Reaction Roll (17). Targets who fail take 4d10+8 damage. Targets who succeed take half damage.',
          { trait: 'Strength' }
        );
      },
    },
  ],
};
