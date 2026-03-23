/**
 * Codex domain — Disintegration Wave (Level 9 spell)
 * SRD: daggerheart-srd/abilities/Disintegration Wave.md
 */

import { spellcastTraitLabel } from './spellcast-label.js';

export const DisintegrationWave = {
  name: 'Disintegration Wave',
  description:
    'Make a **Spellcast Roll (18)**. Once per long rest on a success, the GM tells you which adversaries within Far range have a Difficulty of 18 or lower. **Mark a Stress** for each one you wish to hit with this spell. They are killed and can\'t come back to life by any means.',
  chips: [
    {
      placements: ['card'],
      name: 'Disintegration Wave',
      frequency: 'longRest',
      description:
        'Once per long rest: Spellcast (18). On a success, the GM names adversaries within Far range with Difficulty ≤18; mark 1 Stress per adversary you choose to destroy — they die permanently (no resurrection).',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Disintegration Wave',
          `Make a Spellcast (${trait}) roll (18). Once per long rest on a success, the GM tells you which adversaries within Far range (tokens on the map) have an effective Difficulty of 18 or lower. Mark 1 Stress on yourself for each adversary you wish to hit with this spell. Each one you choose is killed and cannot come back to life by any means.`,
          { trait, difficulty: 18 }
        );
      },
    },
  ],
};
