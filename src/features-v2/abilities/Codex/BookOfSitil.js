/**
 * Codex — Book of Sitil (Tier 1 grimoire)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { spellcastTraitLabel } from './spellcast-label.js';

export const BookOfSitil = {
  name: 'Book of Sitil',
  description:
    '_Adjust Appearance:_ You magically shift your appearance and clothing to avoid recognition.\n\n_Parallela:_ **Spend 2 Hope** to cast this spell on yourself or an ally within Close range. The next time the target makes an attack, they can hit an additional target within range that their attack roll would succeed against. You can only hold this spell on one creature at a time.\n\n_Illusion:_ Make a **Spellcast Roll (14)**. On a success, create a temporary visual illusion no larger than you within Close range that lasts for as long as you look at it. It holds up to scrutiny until an observer is within Melee range.',
  chips: [
    {
      placements: ['card'],
      name: 'Adjust Appearance',
      description: 'Magically shift your appearance and clothing to avoid recognition.',
      onUse(table) {
        table.me.actionLoop(
          'Book of Sitil — Adjust Appearance',
          'Magically shift your appearance and clothing to avoid recognition (GM sets limits).'
        );
      },
    },
    {
      placements: ['card'],
      name: 'Parallela',
      hopeCost: 2,
      description:
        'Self or ally within Close: their next attack can also hit one extra in-range target the roll would succeed against. One creature at a time.',
      onUse(table) {
        table.me.actionLoop(
          'Book of Sitil — Parallela',
          'Spend 2 Hope: target yourself or an ally within Close. The next time they attack, they may also hit an additional target in range that the attack roll would succeed against. Only one creature may hold this at a time.'
        );
      },
    },
    {
      placements: ['card'],
      name: 'Illusion',
      description:
        'Spellcast (14): illusion within Close, your size or smaller; lasts while you watch; fails close scrutiny once an observer is in Melee.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Book of Sitil — Illusion',
          `Make a Spellcast (${trait}) roll (14). On success: create a temporary visual illusion no larger than you within Close range; it lasts while you look at it and holds up to scrutiny until an observer is within Melee range.`,
          { trait }
        );
      },
    },
  ],
};
