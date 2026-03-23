/**
 * Codex — Book of Homet (Tier 1 grimoire; SRD lists as Level 7 domain card)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { spellcastTraitLabel } from './spellcast-label.js';

export const BookOfHomet = {
  name: 'Book of Homet',
  description:
    '_Pass Through:_ Make a **Spellcast Roll (13)**. Once per rest on a success, you and all creatures touching you can pass through a wall or door within Close range. The effect ends once everyone is on the other side.\n\n_Plane Gate:_ Make a **Spellcast Roll (14)**. Once per long rest on a success, open a gateway to a location in another dimension or plane of existence you\'ve been to before. This gateway lasts until your next rest.',
  chips: [
    {
      placements: ['card'],
      name: 'Pass Through',
      frequency: 'rest',
      description:
        'Spellcast (13). Once per rest on success: you and creatures touching you pass through a wall or door within Close range until everyone is on the other side.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Book of Homet — Pass Through',
          `Make a Spellcast (${trait}) roll (13). Once per rest on a success, you and all creatures touching you can pass through a wall or door within Close range. The effect ends once everyone is on the other side.`,
          { trait }
        );
      },
    },
    {
      placements: ['card'],
      name: 'Plane Gate',
      frequency: 'longRest',
      description:
        'Spellcast (14). Once per long rest on success: gateway to a plane you have visited; lasts until your next rest.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Book of Homet — Plane Gate',
          `Make a Spellcast (${trait}) roll (14). Once per long rest on a success, open a gateway to a location in another dimension or plane of existence you have been to before. This gateway lasts until your next rest.`,
          { trait }
        );
      },
    },
  ],
};
