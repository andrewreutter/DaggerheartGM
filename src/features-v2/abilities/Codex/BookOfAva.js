/**
 * Codex — Book of Ava (Tier 1 grimoire)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { spellcastTraitLabel } from './spellcast-label.js';

export const BookOfAva = {
  name: 'Book of Ava',
  description:
    '_Power Push:_ Make a **Spellcast Roll** against a target within Melee range. On a success, they\'re knocked back to Far range and take **d10+2** magic damage using your Proficiency.\n\n_Tava\'s Armor:_ **Spend a Hope** to give a target you can touch a +1 bonus to their Armor Score until their next rest or you cast Tava\'s Armor again.\n\n_Ice Spike:_ Make a **Spellcast Roll (12)** to summon a large ice spike within Far range. If you use it as a weapon, make the Spellcast Roll against the target\'s Difficulty instead. On a success, deal **d6** physical damage using your Proficiency.',
  chips: [
    {
      placements: ['card'],
      name: 'Power Push',
      description:
        'Spellcast vs a target within Melee. On success: knock them to Far range and deal d10+2 magic damage using your Proficiency.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Book of Ava — Power Push',
          `Make a Spellcast (${trait}) roll vs a target within Melee. On a success: they are knocked to Far range and take d10+2 magic damage using your Proficiency.`,
          { trait }
        );
      },
    },
    {
      placements: ['card'],
      name: "Tava's Armor",
      hopeCost: 1,
      description:
        'Touch a target: they gain +1 Armor Score until their next rest or you cast Tava’s Armor again.',
      onUse(table) {
        table.me.actionLoop(
          "Book of Ava — Tava's Armor",
          'Spend Hope: touch a target. They gain +1 Armor Score until their next rest or you cast Tava’s Armor again (GM tracks).'
        );
      },
    },
    {
      placements: ['card'],
      name: 'Ice Spike',
      description:
        'Spellcast (12): summon an ice spike within Far range, or use it as a weapon (roll vs target Difficulty). On success: d6 physical damage using your Proficiency.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Book of Ava — Ice Spike',
          `Make a Spellcast (${trait}) roll (12) to place a large ice spike within Far range. If used as a weapon, roll against the target’s Difficulty instead. On success: deal d6 physical damage using your Proficiency.`,
          { trait }
        );
      },
    },
  ],
};
