/**
 * Codex domain — Teleport (Tier 2 spell)
 * SRD: daggerheart-srd/abilities/Teleport.md
 */

import { spellcastTraitLabel } from './spellcast-label.js';

export const Teleport = {
  name: 'Teleport',
  description:
    'Once per long rest, you can instantly teleport yourself and any number of willing targets within Close range to a place you\'ve been before. Choose one of the following options, then make a **Spellcast Roll (16)**:\n\n- If you know the place very well, gain a +3 bonus.\n- If you\'ve visited the place frequently, gain a +1 bonus.\n- If you\'ve visited the place infrequently, gain no modifier.\n- If you\'ve only been there once, gain a -2 penalty.\n\nOn a success, you appear where you were intending to go. On a failure, you appear off course, with the range of failure determining how far off course.',
  chips: [
    {
      placements: ['card'],
      name: 'Teleport',
      frequency: 'longRest',
      description:
        'Once per long rest: teleport yourself and willing allies in Close range to a place you\'ve visited. Choose familiarity (+3 / +1 / +0 / −2), then Spellcast (16). Success: arrive on target; failure: off course (GM).',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Teleport',
          `Instantly teleport yourself and any number of willing targets within Close range to a place you've been before. Choose familiarity with the destination, then make a Spellcast (${trait}) roll (16): if you know the place very well, +3; visited frequently, +1; infrequently, +0; only once, −2. On a success, you arrive as intended. On a failure, you arrive off course — the range of failure determines how far off course (GM).`,
          { trait, difficulty: 16 }
        );
      },
    },
  ],
};
