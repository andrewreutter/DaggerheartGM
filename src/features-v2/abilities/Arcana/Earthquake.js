/**
 * Arcana domain — Earthquake (Level 9 spell; Recall Cost 2)
 * SRD: Spellcast (16); once per rest on success; Very Far; Reaction 18; 3d10+8 physical + Vulnerable or half; terrain.
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const Earthquake = {
  name: 'Earthquake',
  description:
    '**Recall Cost 2.** Make a **Spellcast Roll (16)**. Once per rest on a success, all targets within Very Far range who aren\'t flying must make a Reaction Roll (18). Targets who fail take **3d10+8** physical damage and are temporarily _Vulnerable_. Targets who succeed take half damage.\n\nAdditionally, when you succeed on the Spellcast Roll, all terrain within Very Far range becomes difficult to move through and structures within this range might sustain damage or crumble.',
  chips: [
    {
      placements: ['card'],
      name: 'Earthquake',
      hopeCost: 2,
      frequency: 'rest',
      description:
        'Spend 2 Hope (recall). Spellcast (16). Once per rest on a success, non-flying targets within Very Far make Reaction Rolls (18): 3d10+8 physical + Vulnerable on failure, half damage on success. Terrain in range becomes difficult; structures may crumble.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Earthquake',
          `Spend 2 Hope (recall). Make a Spellcast (${trait}) roll (16). Once per rest on a success, all targets within Very Far range who aren't flying must make a Reaction Roll (18). Targets who fail take 3d10+8 physical damage and are temporarily Vulnerable. Targets who succeed take half damage. Additionally, when you succeed on the Spellcast Roll, all terrain within Very Far range becomes difficult to move through and structures within this range might sustain damage or crumble.`,
          { trait, difficulty: 16 }
        );
      },
    },
  ],
};
