/**
 * Grace domain — Tell No Lies (Tier 1)
 * SRD: Spellcast vs Very Close; on success target cannot lie while within Close range (GM adjudicates questions / refusal).
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const TellNoLies = {
  name: 'Tell No Lies',
  description:
    'Make a **Spellcast Roll** against a target within Very Close range. On a success, they can\'t lie to you while they remain within Close range, but they are not compelled to speak. If you ask them a question and they refuse to answer, they must mark a Stress and the effect ends. The target is typically unaware this spell has been cast on them until it causes them to utter the truth.',
  chips: [
    {
      placements: ['card'],
      name: 'Tell No Lies',
      description:
        'Spellcast vs a target within Very Close range. On success: they cannot lie to you while within Close range (GM tracks questions and refusal).',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Tell No Lies',
          `Make a Spellcast (${trait}) roll vs a target within Very Close range. On a success, they cannot lie to you while they remain within Close range; refusal to answer a question marks Stress and ends the effect (GM).`,
          { trait }
        );
      },
    },
  ],
};
