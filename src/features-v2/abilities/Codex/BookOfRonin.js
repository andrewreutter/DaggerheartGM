/**
 * Codex — Book of Ronin (Level 9 grimoire)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { spellcastTraitLabel } from './spellcast-label.js';

export const BookOfRonin = {
  name: 'Book of Ronin',
  description:
    '_Transform:_ Make a **Spellcast Roll (15)**. On a success, transform into an inanimate object no larger than twice your normal size. You can remain in this shape until you take damage.\n\n_Eternal Enervation:_ Once per long rest, make a **Spellcast Roll** against a target within Close range. On a success, they become permanently _Vulnerable_. They can\'t clear this condition by any means.',
  chips: [
    {
      placements: ['card'],
      name: 'Transform',
      description:
        'Spellcast (15). On success: become an inanimate object up to twice your size until you take damage.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Book of Ronin — Transform',
          `Make a Spellcast (${trait}) roll (15). On a success, transform into an inanimate object no larger than twice your normal size. You can remain in this shape until you take damage.`,
          { trait, difficulty: 15 }
        );
      },
    },
    {
      placements: ['card'],
      name: 'Eternal Enervation',
      frequency: 'longRest',
      description:
        'Spellcast vs a target within Close range. On success: they become permanently Vulnerable (cannot clear by any means).',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Book of Ronin — Eternal Enervation',
          `Once per long rest, make a Spellcast (${trait}) roll against a target within Close range. On a success, they become permanently Vulnerable. They cannot clear this condition by any means.`,
          { trait }
        );
      },
    },
  ],
};
