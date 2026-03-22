/**
 * Arcana domain — Chain Lightning (Tier 2)
 * SRD: Mark 2 Stress; Spellcast vs Close; reaction rolls vs Spellcast result; chain damage on failures.
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const ChainLightning = {
  name: 'Chain Lightning',
  description:
    '**Mark 2 Stress** to make a **Spellcast Roll**, unleashing lightning on all targets within Close range. Targets you succeed against must make a reaction roll with a Difficulty equal to the result of your Spellcast Roll. Targets who fail take **2d8+4** magic damage. Additional adversaries not already targeted by Chain Lightning and within Close range of previous targets who took damage must also make the reaction roll. Targets who fail take **2d8+4** magic damage. This chain continues until there are no more adversaries within range.',
  chips: [
    {
      placements: ['card'],
      name: 'Chain Lightning',
      stressCost: 2,
      description:
        'Mark 2 Stress. Spellcast vs all within Close; chain reaction rolls (Difficulty = your Spellcast result) and 2d8+4 magic damage on failures (GM resolves chain).',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Chain Lightning',
          `Mark 2 Stress. Make a Spellcast (${trait}) roll, unleashing lightning on all targets within Close range. Targets you succeed against must make a reaction roll vs Difficulty equal to your Spellcast result. Failed reactions take 2d8+4 magic damage. Chain to new adversaries within Close range of damaged targets until no valid targets remain.`,
          { trait }
        );
      },
    },
  ],
};
