/**
 * Arcana domain — Telekinesis (Tier 2)
 * SRD: Spellcast vs Far to move a target within Far of their origin; optional second Spellcast to throw for d12+4 physical (Proficiency).
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const Telekinesis = {
  name: 'Telekinesis',
  description:
    'Make a **Spellcast Roll** against a target within Far range. On a success, you can use your mind to move them anywhere within Far range of their original position. You can throw the lifted target as an attack by making an additional Spellcast Roll against the second target you\'re trying to attack. On a success, deal **d12+4** physical damage to the second target using your Proficiency. This spell then ends.',
  chips: [
    {
      placements: ['card'],
      name: 'Telekinesis',
      description:
        'Spellcast vs a target within Far range. On a success, move them anywhere within Far range of where they started. You may make a second Spellcast vs another target to throw the lifted target at them; on a success, deal d12+4 physical damage (Proficiency). The spell then ends.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Telekinesis',
          `Make a Spellcast (${trait}) roll against a target within Far range. On a success, move them anywhere within Far range of their original position. You may make an additional Spellcast (${trait}) roll against a second target to throw the lifted target; on a success, deal d12+4 physical damage using your Proficiency. The spell then ends.`,
          { trait }
        );
      },
    },
  ],
};
