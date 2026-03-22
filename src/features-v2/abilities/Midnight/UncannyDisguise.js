/**
 * Midnight domain — Uncanny Disguise (Tier 1)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { when, isActing } from '../../engine/when.js';
import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

function spellcastTokenCount(table) {
  const key = table.me?.spellcastTrait;
  if (!key || !table.me?.traits) return 1;
  const v = Number(table.me.traits[key]);
  return Math.max(1, Number.isFinite(v) ? v : 1);
}

export const UncannyDisguise = {
  name: 'Uncanny Disguise',
  description:
    'When you have a few minutes to prepare, you can **mark a Stress** to don the facade of any humanoid you can picture clearly in your mind. While disguised, you have advantage on Presence Rolls to avoid scrutiny.\n\nPlace a number of tokens equal to your Spellcast trait on this card. When you take an action while disguised, spend a token from this card. After the action that spends the last token is resolved, the disguise drops.',
  advantageTriggers: [
    when(
      (table) =>
        (table.feature.get('uncannyDisguiseTokens') ?? 0) > 0 &&
        table.action?.trait === 'presence',
      'Presence rolls to avoid scrutiny while disguised'
    ),
  ],
  hooks: {
    onResolve: when(
      isActing,
      (table) => (table.feature.get('uncannyDisguiseTokens') ?? 0) > 0,
      (table) => {
        const n = table.feature.get('uncannyDisguiseTokens');
        table.feature.set('uncannyDisguiseTokens', n - 1);
      }
    ),
  },
  chips: [
    {
      placements: ['card'],
      name: 'Uncanny Disguise',
      stressCost: 1,
      description:
        'After a few minutes to prepare: mark 1 Stress and don a humanoid disguise. Place tokens equal to your Spellcast trait; each action you resolve spends one token (GM). After the last token is spent, the disguise drops.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        const count = spellcastTokenCount(table);
        table.feature.set('uncannyDisguiseTokens', count);
        table.me.actionLoop(
          'Uncanny Disguise',
          `Mark 1 Stress. After preparing, you take on a humanoid disguise. Place ${count} token(s) on this card (Spellcast trait). While tokens remain, you have advantage on Presence rolls to avoid scrutiny. Each action you take spends one token after it resolves; when the last is spent, the disguise drops.`,
          { trait }
        );
      },
    },
  ],
};
