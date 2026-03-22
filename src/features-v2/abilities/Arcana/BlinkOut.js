/**
 * Arcana domain — Blink Out (Tier 2)
 * SRD: Spellcast (12); on success spend Hope to teleport Far; optional Hope per ally in Very Close to bring them.
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const BlinkOut = {
  name: 'Blink Out',
  description:
    'Make a **Spellcast Roll (12)**. On a success, **spend a Hope** to teleport to another point you can see within Far range. If any willing creatures are within Very Close range, **spend an additional Hope** for each creature to bring them with you.',
  chips: [
    {
      placements: ['card'],
      name: 'Blink Out',
      description:
        'Spellcast (12). On a success, spend 1 Hope to teleport to a point you can see within Far range; spend 1 additional Hope per willing creature within Very Close to bring them with you.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Blink Out',
          `Make a Spellcast (${trait}) roll (12). On a success, spend 1 Hope to teleport to another point you can see within Far range. For each willing creature within Very Close range, spend an additional Hope to bring them with you.`,
          { trait, difficulty: 12 }
        );
      },
    },
  ],
};
