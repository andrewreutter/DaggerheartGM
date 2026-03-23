/**
 * Codex domain — Banish (Tier 2 / level 6 spell)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { spellcastTraitLabel } from './spellcast-label.js';

export const Banish = {
  name: 'Banish',
  description:
    'Make a **Spellcast Roll** against a target within Close range. On a success, roll a number of **d20s** equal to your Spellcast trait. The target must make a reaction roll with a Difficulty equal to your highest result. On a success, the target must mark a Stress but isn\'t banished. Once per rest on a failure, they are banished from this realm.\n\nWhen the PCs roll with Fear, the Difficulty gains a -1 penalty and the target makes another reaction roll. On a success, they return from banishment.',
  chips: [
    {
      placements: ['card'],
      name: 'Banish',
      description:
        'Spellcast vs a target within Close range. On success: roll d20s equal to your Spellcast trait; target reacts vs Difficulty = your highest die. Reaction success: they mark Stress. Once per rest on reaction failure: banished.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Banish',
          `Make a Spellcast (${trait}) roll against a target within Close range. On a success, roll a number of d20s equal to your Spellcast trait score. The target makes a reaction roll with a Difficulty equal to your highest d20. On a success, they mark a Stress and are not banished. Once per rest on a failure, they are banished from this realm (track the once-per-rest banishment).`,
          { trait }
        );
      },
    },
    {
      placements: ['card'],
      name: 'Banish — Fear & return',
      description:
        'When the PCs roll with Fear, the banished target\'s Difficulty takes −1 and they make another reaction roll; on a success, they return from banishment.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Banish — Fear & return',
          `When the PCs roll with Fear while a banishment is active: the Difficulty gains a −1 penalty and the banished target makes another reaction roll. On a success, they return from banishment. (Spellcast trait label: ${trait}.)`,
          { trait }
        );
      },
    },
  ],
};
