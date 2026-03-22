/**
 * Sage domain — Vicious Entangle (Tier 1)
 * SRD: Spellcast vs Far — 1d8+1 physical + Restrain; may spend Hope to Restrain another adversary Very Close to target.
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const ViciousEntangle = {
  name: 'Vicious Entangle',
  description:
    'Make a **Spellcast Roll** against a target within Far range. On a success, roots and vines reach out from the ground, dealing **1d8+1** physical damage and temporarily _Restraining_ the target.\n\nAdditionally on a success, you can **spend a Hope** to temporarily _Restrain_ another adversary within Very Close range of your target.',
  chips: [
    {
      placements: ['card'],
      name: 'Vicious Entangle',
      description:
        'Spellcast vs a target within Far range. On a success: 1d8+1 physical damage and Restrained. On a success you may spend 1 Hope to Restrain another adversary within Very Close range of that target.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Vicious Entangle',
          `Make a Spellcast (${trait}) roll against a target within Far range. On a success, roots and vines deal 1d8+1 physical damage and temporarily Restrain the target. On a success, you may spend 1 Hope to temporarily Restrain another adversary within Very Close range of your target.`,
          { trait }
        );
      },
    },
  ],
};
