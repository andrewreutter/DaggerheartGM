/**
 * Splendor domain — Final Words (Tier 1 domain card slot)
 * SRD: Spellcast (13), speak with corpse; Hope vs Fear answer counts.
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const FinalWords = {
  name: 'Final Words',
  description:
    'You can infuse a corpse with a moment of life to speak with it. Make a **Spellcast Roll (13)**. On a success with Hope, the corpse answers up to three questions. On a success with Fear, the corpse answers one question. The corpse answers truthfully, but it can\'t impart information it didn\'t know in life. On a failure, or once the corpse has finished answering your questions, the body turns to dust.',
  chips: [
    {
      placements: ['card'],
      name: 'Final Words',
      description:
        'Spellcast (13): on success with Hope, up to three questions; on success with Fear, one question; truthfully, only what it knew in life. On failure or after answers, the body turns to dust.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Final Words',
          `Make a Spellcast (${trait}) roll (13). On a success with Hope, the corpse answers up to three questions. On a success with Fear, the corpse answers one question. The corpse answers truthfully, but it cannot impart information it did not know in life. On a failure, or once the corpse has finished answering your questions, the body turns to dust.`,
          { trait, difficulty: 13 }
        );
      },
    },
  ],
};
