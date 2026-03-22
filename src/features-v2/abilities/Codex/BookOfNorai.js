/**
 * Codex — Book of Norai (Tier 1 grimoire; SRD lists as Level 3 domain card)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { spellcastTraitLabel } from './spellcast-label.js';

export const BookOfNorai = {
  name: 'Book of Norai',
  description:
    '_Mystic Tether:_ Make a **Spellcast Roll** against a target within Far range. On a success, they\'re temporarily _Restrained_ and must mark a Stress. If you target a flying creature, this spell grounds and temporarily _Restrains_ them.\n\n_Fireball:_ Make a **Spellcast Roll** against a target within Very Far range. On a success, hurl a sphere of fire toward them that explodes on impact. The target and all creatures within Very Close range of them must make a Reaction Roll (13). Targets who fail take **d20+5** magic damage using your Proficiency. Targets who succeed take half damage.',
  chips: [
    {
      placements: ['card'],
      name: 'Mystic Tether',
      description:
        'Spellcast vs a target within Far range. On success: Restrained and they mark a Stress; flying targets are grounded and Restrained.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Book of Norai — Mystic Tether',
          `Make a Spellcast (${trait}) roll against a target within Far range. On a success: they are temporarily Restrained and must mark a Stress. If you target a flying creature, this spell grounds and Restrains them.`,
          { trait }
        );
      },
    },
    {
      placements: ['card'],
      name: 'Fireball',
      description:
        'Spellcast vs a target within Very Far. On success: explosion — Very Close radius Reaction Roll (13); failure d20+5 magic (Proficiency), success half.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Book of Norai — Fireball',
          `Make a Spellcast (${trait}) roll against a target within Very Far range. On a success, hurl fire that explodes on impact: the target and all creatures within Very Close range of them make a Reaction Roll (13). Failed: d20+5 magic damage using your Proficiency. Success: half damage.`,
          { trait }
        );
      },
    },
  ],
};
