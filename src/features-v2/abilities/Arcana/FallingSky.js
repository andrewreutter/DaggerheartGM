/**
 * Arcana domain — Falling Sky (Tier 3 / Level 10)
 * SRD: Spellcast vs all adversaries in Far; mark any Stress; 1d20+2 magic per Stress on successes.
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const FallingSky = {
  name: 'Falling Sky',
  description:
    'Make a **Spellcast Roll** against all adversaries within Far range. **Mark any number of Stress** to make shards of arcana rain down from above. Targets you succeed against take **1d20+2** magic damage for each Stress marked.',
  chips: [
    {
      placements: ['card'],
      name: 'Falling Sky',
      hopeCost: 1,
      description:
        'Spend 1 Hope (recall). Spellcast vs all adversaries within Far range. Mark any number of Stress; each succeeded target takes 1d20+2 magic damage per Stress marked (GM resolves rolls).',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Falling Sky',
          `Spend 1 Hope (recall). Make a Spellcast (${trait}) roll against all adversaries within Far range. Mark any number of Stress to make shards of arcana rain down from above. Targets you succeed against take 1d20+2 magic damage for each Stress marked.`,
          { trait }
        );
      },
    },
  ],
};
