/**
 * Grace domain — Hypnotic Shimmer (Tier 1)
 * SRD: Spellcast vs adversaries in front within Close; once per rest on success Stun + Stress on hits.
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const HypnoticShimmer = {
  name: 'Hypnotic Shimmer',
  description:
    'Make a **Spellcast Roll** against all adversaries in front of you within Close range. Once per rest on a success, create an illusion of flashing colors and lights that temporarily _Stuns_ targets you succeed against and forces them to mark a Stress. While _Stunned_, they can\'t use reactions and can\'t take any other actions until they clear this condition.',
  chips: [
    {
      placements: ['card'],
      name: 'Hypnotic Shimmer',
      frequency: 'rest',
      description:
        'Spellcast vs adversaries in front of you within Close range. Once per rest on a success: targets you succeed against are Stunned and mark a Stress; while Stunned they cannot use reactions or take other actions until cleared (GM).',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Hypnotic Shimmer',
          `Make a Spellcast (${trait}) roll against all adversaries in front of you within Close range. Once per rest on a success: targets you succeed against are temporarily Stunned and must mark a Stress. While Stunned, they cannot use reactions or take other actions until they clear this condition.`,
          { trait }
        );
      },
    },
  ],
};
