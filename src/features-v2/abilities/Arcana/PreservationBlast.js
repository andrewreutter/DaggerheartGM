/**
 * Arcana domain — Preservation Blast (Tier 2)
 * SRD: Spellcast vs all in Melee; success pushes to Far and deals d8+3 magic (Spellcast trait).
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const PreservationBlast = {
  name: 'Preservation Blast',
  description:
    'Make a **Spellcast Roll** against all targets within Melee range. Targets you succeed against are forced back to Far range and take **d8+3** magic damage using your Spellcast trait.',
  chips: [
    {
      placements: ['card'],
      name: 'Preservation Blast',
      description:
        'Spellcast vs all targets within Melee range. Each you succeed against is forced to Far range and takes d8+3 magic damage (Spellcast trait).',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Preservation Blast',
          `Make a Spellcast (${trait}) roll against all targets within Melee range. Targets you succeed against are forced back to Far range and take d8+3 magic damage using your Spellcast trait.`,
          { trait }
        );
      },
    },
  ],
};
