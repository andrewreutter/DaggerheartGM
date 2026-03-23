/**
 * Sage domain — Forest Sprites (Tier 2)
 * SRD: Level 8. Recall Cost 2. Spellcast (13); on success spend N Hope for N sprites within Far range.
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const ForestSprites = {
  name: 'Forest Sprites',
  description:
    '**Recall Cost 2.** Make a **Spellcast Roll (13)**. On a success, **spend any number of Hope** to create an equal number of small forest sprites who appear at points you choose within Far range, providing the following benefits:\n\n- Your allies gain a +3 bonus to attack rolls against adversaries within Melee range of a sprite.\n- An ally who marks an Armor Slot while within Melee range of a sprite can mark an additional Armor Slot.\n\nA sprite vanishes after granting a benefit or taking any damage.',
  chips: [
    {
      placements: ['card'],
      name: 'Forest Sprites',
      hopeCost: 2,
      description:
        'Spend 2 Hope (recall). Spellcast (13). On a success, spend any number of Hope to place that many sprites at points within Far range. Allies get +3 to attacks vs adversaries within Melee of a sprite; an ally marking Armor near a sprite may mark an additional Armor Slot. A sprite vanishes after it grants a benefit or takes damage.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Forest Sprites',
          `Spend 2 Hope (recall). Make a Spellcast (${trait}) roll (13). On a success, spend any number of Hope to conjure that many forest sprites at points you choose within Far range. While a sprite lasts: your allies gain +3 to attack rolls against adversaries within Melee range of a sprite; an ally who marks an Armor Slot while within Melee range of a sprite may mark an additional Armor Slot. A sprite vanishes after granting a benefit or taking any damage (GM tracks sprites).`,
          { trait, difficulty: 13 }
        );
      },
    },
  ],
};
