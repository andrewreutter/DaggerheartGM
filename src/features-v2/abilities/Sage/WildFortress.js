/**
 * Sage domain — Wild Fortress (Tier 1)
 * SRD: Spellcast (13); on success spend 2 Hope for a protective dome (3 HP, thresholds 15/30)
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const WildFortress = {
  name: 'Wild Fortress',
  description:
    'Make a **Spellcast Roll (13)**. On a success, **spend 2 Hope** to grow a natural barricade in the shape of a dome that you and one ally can take cover within. While inside the dome, a creature can\'t be targeted by attacks and can\'t make attacks. Attacks made against the dome automatically succeed. The dome has the following damage thresholds and lasts until it marks 3 Hit Points. Place tokens on this card to represent marking Hit Points.\n\nThresholds: 15/30',
  chips: [
    {
      placements: ['card'],
      name: 'Wild Fortress',
      description:
        'Spellcast (13). On a success, spend 2 Hope to raise a dome barricade for you and one ally. Occupants can\'t attack or be targeted by attacks. Attacks vs the dome auto-hit. Dome: Major 15 / Severe 30; lasts until 3 HP marked on this card (track with tokens).',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Wild Fortress',
          `Make a Spellcast (${trait}) roll (13). On a success, spend 2 Hope to grow a natural barricade (dome) that you and one ally can take cover within. While inside, a creature can't be targeted by attacks and can't make attacks. Attacks against the dome automatically succeed. The dome uses Major 15 / Severe 30 thresholds and lasts until it marks 3 Hit Points — place tokens on this card to track HP marked on the dome.`,
          { trait, difficulty: 13 }
        );
      },
    },
  ],
};
