/**
 * Codex — Book of Tyfar (Tier 1 grimoire)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { spellcastTraitLabel } from './spellcast-label.js';

export const BookOfTyfar = {
  name: 'Book of Tyfar',
  description:
    '_Wild Flame:_ Make a **Spellcast Roll** against up to three adversaries within Melee range. Targets you succeed against take **2d6** magic damage and must mark a Stress as flames erupt from your hand.\n\n_Magic Hand:_ You conjure a magical hand with the same size and strength as your own within Far range.\n\n_Mysterious Mist:_ Make a **Spellcast Roll (13)** to cast a temporary thick fog that gathers in a stationary area within Very Close range. The fog heavily obscures this area and everything in it.',
  chips: [
    {
      placements: ['card'],
      name: 'Wild Flame',
      description:
        'Spellcast vs up to three adversaries in Melee. Each hit: 2d6 magic damage and they mark a Stress.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Book of Tyfar — Wild Flame',
          `Make a Spellcast (${trait}) roll against up to three adversaries within Melee. Each you succeed against takes 2d6 magic damage and marks a Stress.`,
          { trait }
        );
      },
    },
    {
      placements: ['card'],
      name: 'Magic Hand',
      description:
        'Conjure a magical hand with the same size and strength as your own within Far range.',
      onUse(table) {
        table.me.actionLoop(
          'Book of Tyfar — Magic Hand',
          'Conjure a magical hand with the same size and strength as your own within Far range (GM adjudicates manipulation).'
        );
      },
    },
    {
      placements: ['card'],
      name: 'Mysterious Mist',
      description: 'Spellcast (13): thick stationary fog in Very Close range that heavily obscures the area.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Book of Tyfar — Mysterious Mist',
          `Make a Spellcast (${trait}) roll (13). On success: a stationary thick fog in Very Close range heavily obscures that area and everything in it.`,
          { trait }
        );
      },
    },
  ],
};
