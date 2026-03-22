/**
 * Sage domain — Corrosive Projectile (Tier 1)
 * SRD: Spellcast Far, d6+4 magic + Proficiency; Stress for Corroded difficulty penalty
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const CorrosiveProjectile = {
  name: 'Corrosive Projectile',
  description:
    'Make a **Spellcast Roll** against a target within Far range. On a success, deal **d6+4** magic damage using your Proficiency. Additionally, **mark 2 or more Stress** to make them permanently _Corroded_. While a target is _Corroded_, they gain a -1 penalty to their Difficulty for every 2 Stress you spent. This condition can stack.',
  chips: [
    {
      placements: ['card'],
      name: 'Corrosive Projectile',
      description:
        'Spellcast vs a target within Far. On a success: d6+4 magic damage (Proficiency). You may mark 2+ Stress to inflict permanent Corroded (-1 Difficulty per 2 Stress spent; stacks).',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Corrosive Projectile',
          `Make a Spellcast (${trait}) roll against a target within Far range. On a success, deal d6+4 magic damage using your Proficiency. You may mark 2 or more Stress to make them permanently Corroded: -1 Difficulty per 2 Stress spent (stacks; GM tracks).`,
          { trait }
        );
      },
    },
  ],
};
