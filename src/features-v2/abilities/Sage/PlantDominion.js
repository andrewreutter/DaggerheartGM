/**
 * Sage domain — Plant Dominion (Tier 2 domain spell / SRD level 9; Recall Cost 1)
 * SRD: daggerheart-srd/abilities/Plant Dominion.md
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const PlantDominion = {
  name: 'Plant Dominion',
  description:
    'Make a **Spellcast Roll (18)**. Once per long rest on a success, you reshape the natural world, changing the surrounding plant life anywhere within Far range of you. For example, you can grow trees instantly, clear a path through dense vines, or create a wall of roots.',
  chips: [
    {
      placements: ['card'],
      name: 'Plant Dominion',
      hopeCost: 1,
      frequency: 'longRest',
      description:
        'Once per long rest: Spellcast (18), 1 Hope (recall). On a success, reshape plant life within Far range (grow trees, clear vines, wall of roots, etc.; work with the GM).',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Plant Dominion',
          `Make a Spellcast (${trait}) roll (18). Once per long rest on a success, you reshape the natural world, changing the surrounding plant life anywhere within Far range of you. For example, you can grow trees instantly, clear a path through dense vines, or create a wall of roots.`,
          { trait, difficulty: 18 }
        );
      },
    },
  ],
};
