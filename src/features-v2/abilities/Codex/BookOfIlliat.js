/**
 * Codex — Book of Illiat (Tier 1 grimoire)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { spellcastTraitLabel } from './spellcast-label.js';

export const BookOfIlliat = {
  name: 'Book of Illiat',
  description:
    '_Slumber:_ Make a **Spellcast Roll** against a target within Very Close range. On a success, they\'re _Asleep_ until they take damage or the GM spends a Fear on their turn to clear this condition.\n\n_Arcane Barrage:_ Once per rest, **spend any number of Hope** and shoot magical projectiles that strike a target of your choice within Close range. Roll a number of **d6s** equal to the Hope spent and deal that much magic damage to the target.\n\n_Telepathy:_ **Spend a Hope** to open a line of mental communication with one target you can see. This connection lasts until your next rest or you cast Telepathy again.',
  chips: [
    {
      placements: ['card'],
      name: 'Slumber',
      description:
        'Spellcast vs a target within Very Close. On success: they are Asleep until they take damage or the GM spends Fear on their turn to clear.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Book of Illiat — Slumber',
          `Make a Spellcast (${trait}) roll vs a target within Very Close range. On a success: they are Asleep until they take damage or the GM spends a Fear on their turn to clear this condition.`,
          { trait }
        );
      },
    },
    {
      placements: ['card'],
      name: 'Arcane Barrage',
      frequency: 'rest',
      description:
        'Once per rest: spend any number of Hope; roll that many d6s as magic damage to one target within Close range.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Book of Illiat — Arcane Barrage',
          `Once per rest: spend any number of Hope, then roll that many d6s and deal the total as magic damage to a target of your choice within Close range (Spellcast ${trait} as needed for the table).`,
          { trait }
        );
      },
    },
    {
      placements: ['card'],
      name: 'Telepathy',
      hopeCost: 1,
      description:
        'Open mental communication with one target you can see until your next rest or you cast Telepathy again.',
      onUse(table) {
        table.me.actionLoop(
          'Book of Illiat — Telepathy',
          'Spend Hope: choose one target you can see. You share a mental link until your next rest or you cast Telepathy again.'
        );
      },
    },
  ],
};
