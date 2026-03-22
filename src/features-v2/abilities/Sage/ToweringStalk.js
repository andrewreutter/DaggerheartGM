/**
 * Sage domain — Towering Stalk (Tier 1)
 * SRD: rest — conjure climbable stalk; Stress — attack mode Spellcast Close
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const ToweringStalk = {
  name: 'Towering Stalk',
  description:
    'Once per rest, you can conjure a thick, twisting stalk within Close range that can be easily climbed. Its height can grow up to Far range. **Mark a Stress** to use this spell as an attack. Make a **Spellcast Roll** against an adversary or group of adversaries within Close range. The erupting stalk lifts targets you succeed against into the air and drops them, dealing **d8** physical damage using your Proficiency.',
  chips: [
    {
      placements: ['card'],
      name: 'Conjure climbing stalk',
      frequency: 'rest',
      description:
        'Once per rest: conjure a thick, twisting stalk within Close range that can be climbed; its height can reach up to Far range.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Towering Stalk — Climbing stalk',
          `Once per rest: conjure a thick, twisting stalk within Close range that can be easily climbed; height can grow up to Far range (Spellcast ${trait} / GM resolves positioning).`,
          { trait }
        );
      },
    },
    {
      placements: ['card'],
      name: 'Erupting stalk',
      stressCost: 1,
      description:
        'Mark Stress: Spellcast vs adversaries within Close range; targets you succeed against are lifted and dropped for d8 physical damage (Proficiency).',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Towering Stalk — Erupting attack',
          `Mark Stress. Make a Spellcast (${trait}) roll against an adversary or group of adversaries within Close range. The erupting stalk lifts targets you succeed against into the air and drops them, dealing d8 physical damage using your Proficiency.`,
          { trait }
        );
      },
    },
  ],
};
