/**
 * Grace domain — Invisibility (Tier 1)
 * SRD: Spellcast (10); on success mark Stress; Invisible + tokens on card; one creature at a time.
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const Invisibility = {
  name: 'Invisibility',
  description:
    'Make a **Spellcast Roll (10)**. On a success, **mark a Stress** and choose yourself or an ally within Melee range to become _Invisible_. An _Invisible_ creature can\'t be seen except through magical means and attack rolls against them are made with disadvantage. Place a number of tokens on this card equal to your Spellcast trait. When the _Invisible_ creature takes an action, spend a token from this card. After the action that spends the last token is resolved, the effect ends. You can only hold Invisibility on one creature at a time.',
  chips: [
    {
      placements: ['card'],
      name: 'Invisibility',
      description:
        'Spellcast (10): on success mark 1 Stress and choose you or an ally in Melee to become Invisible; place tokens equal to your Spellcast trait; spend one when the Invisible creature takes an action; ends after the last token is spent. One subject at a time; attacks vs Invisible have disadvantage (GM).',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Invisibility',
          `Make a Spellcast (${trait}) roll (10). On a success, mark 1 Stress and choose yourself or an ally within Melee range to become Invisible. Place tokens on this card equal to your Spellcast trait. When the Invisible creature takes an action, spend a token from this card; after the action that spends the last token is resolved, the effect ends. Only one creature may hold Invisibility at a time. Attack rolls against an Invisible creature are made with disadvantage.`,
          { trait }
        );
      },
    },
  ],
};
