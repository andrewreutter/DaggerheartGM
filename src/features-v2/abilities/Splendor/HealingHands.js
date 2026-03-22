/**
 * Splendor domain — Healing Hands (Tier 1 domain card slot)
 * SRD: Spellcast (13), Melee range other; mark Stress to heal; once per target until long rest.
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const HealingHands = {
  name: 'Healing Hands',
  description:
    'Make a **Spellcast Roll (13)** and target a creature other than yourself within Melee range. On a success, **mark a Stress** to clear 2 Hit Points or 2 Stress on the target. On a failure, **mark a Stress** to clear a Hit Point or a Stress on the target. You can\'t heal the same target again until your next long rest.',
  chips: [
    {
      placements: ['card'],
      name: 'Healing Hands',
      description:
        'Spellcast (13) vs another creature in Melee: on success mark 1 Stress and clear 2 HP or 2 Stress; on failure mark 1 Stress and clear 1 HP or 1 Stress. You cannot heal the same target again until your next long rest (GM tracks targets).',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Healing Hands',
          `Make a Spellcast (${trait}) roll (13) and target a creature other than yourself within Melee range. On a success, mark 1 Stress to clear 2 Hit Points or 2 Stress on the target. On a failure, mark 1 Stress to clear 1 Hit Point or 1 Stress on the target. You cannot heal the same target again until your next long rest.`,
          { trait, difficulty: 13 }
        );
      },
    },
  ],
};
