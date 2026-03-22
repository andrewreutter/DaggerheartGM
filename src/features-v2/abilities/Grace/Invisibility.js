/**
 * Grace domain — Invisibility (Tier 1)
 * SRD: Spellcast (10); on success mark Stress; Invisible + tokens on card; one creature at a time.
 */

import { when, isActing } from '../../engine/when.js';
import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

function spellcastTokenCount(table) {
  const key = table.me?.spellcastTrait;
  if (!key || !table.me?.traits) return 1;
  const v = Number(table.me.traits[key]);
  return Math.max(1, Number.isFinite(v) ? v : 1);
}

export const Invisibility = {
  name: 'Invisibility',
  description:
    'Make a **Spellcast Roll (10)**. On a success, **mark a Stress** and choose yourself or an ally within Melee range to become _Invisible_. An _Invisible_ creature can\'t be seen except through magical means and attack rolls against them are made with disadvantage. Place a number of tokens on this card equal to your Spellcast trait. When the _Invisible_ creature takes an action, spend a token from this card. After the action that spends the last token is resolved, the effect ends. You can only hold Invisibility on one creature at a time.',
  hooks: {
    onReviewAction: when(
      isActing,
      (table) =>
        table.action?.type === 'spellcast' &&
        table.feature.get('invisibilityAwaitingRoll') === true &&
        typeof table.rolls?.action?.isSuccess === 'boolean',
      (table) => {
        table.feature.set('invisibilityAwaitingRoll', false);
        if (table.rolls?.action?.isSuccess !== true) return;
        const n = spellcastTokenCount(table);
        table.feature.set('invisibilityTokens', n);
        table.feature.set('invisibilitySubjectId', table.me.instanceId);
        table.me.markStress(1);
      }
    ),
    onResolve: when(
      (table) => {
        const subj = table.feature.get('invisibilitySubjectId');
        if (!subj) return false;
        const tok = table.feature.get('invisibilityTokens') ?? 0;
        if (tok <= 0) return false;
        return table.action?.actor?.instanceId === subj;
      },
      (table) => {
        const n = table.feature.get('invisibilityTokens');
        table.feature.set('invisibilityTokens', n - 1);
        if (n - 1 <= 0) {
          table.feature.set('invisibilitySubjectId', null);
        }
      }
    ),
  },
  chips: [
    {
      placements: ['card'],
      name: 'Invisibility',
      description:
        'Spellcast (10): on success mark 1 Stress and choose you or an ally in Melee to become Invisible; place tokens equal to your Spellcast trait; spend one when the Invisible creature takes an action; ends after the last token is spent. One subject at a time; attacks vs Invisible have disadvantage (GM).',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.feature.set('invisibilityAwaitingRoll', true);
        table.me.actionLoop(
          'Invisibility',
          `Make a Spellcast (${trait}) roll (10). On a success, mark 1 Stress and choose yourself or an ally within Melee range to become Invisible. Place tokens on this card equal to your Spellcast trait. When the Invisible creature takes an action, spend a token from this card; after the action that spends the last token is resolved, the effect ends. Only one creature may hold Invisibility at a time. Attack rolls against an Invisible creature are made with disadvantage.`,
          { trait, difficulty: 10 }
        );
      },
    },
  ],
};
