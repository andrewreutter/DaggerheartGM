/**
 * Sage domain — Thorn Skin (Tier 2 / level 5 spell)
 * SRD: daggerheart-srd/abilities/Thorn Skin.md
 */

import { when, isTargeted, hasDamage } from '../../engine/when.js';
import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

function spellcastScore(table) {
  const key = table.me?.spellcastTrait;
  if (!key || typeof key !== 'string') return 0;
  const t = table.me?.traits ?? {};
  const k = key.toLowerCase();
  return t[k] ?? t[key] ?? 0;
}

function hasThornTokens(table) {
  return (table.feature.get('thornSkinTokens') ?? 0) > 0;
}

function thornSkinSpendSelectOptions(table) {
  const tokens = table.feature.get('thornSkinTokens') ?? 0;
  if (tokens <= 0) return [];
  return Array.from({ length: tokens }, (_, i) => ({
    id: String(i + 1),
    name: `Spend ${i + 1} token${i === 0 ? '' : 's'}`,
  }));
}

export const ThornSkin = {
  name: 'Thorn Skin',
  description:
    'Once per rest, **spend a Hope** to sprout thorns all over your body. When you do, place a number of tokens equal to your Spellcast trait on this card. When you take damage, you can spend any number of tokens to roll that number of **d6s**. Add the results together and reduce the incoming damage by that amount. If you\'re within Melee range of the attacker, deal that amount of damage back to them.\n\nWhen you take a rest, clear all unspent tokens.',
  chips: [
    {
      placements: ['card'],
      name: 'Sprout thorns',
      hopeCost: 1,
      frequency: 'rest',
      description:
        'Once per rest: spend 1 Hope to sprout thorns; place tokens on this card equal to your Spellcast trait.',
      onUse(table) {
        const n = spellcastScore(table);
        if (n <= 0) return;
        table.feature.set('thornSkinTokens', n);
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Thorn Skin',
          `Spend 1 Hope: sprout thorns and place ${n} token(s) on this card (Spellcast trait — ${trait}). When you take damage, spend tokens to roll d6s and reduce that hit; in Melee with the attacker, deal the rolled total back to them. Unspent tokens clear when you take a rest.`
        );
      },
    },
    when(
      isTargeted,
      hasDamage,
      hasThornTokens,
      {
        name: 'Thorn Skin',
        placements: ['reviewAction'],
        description:
          'When you take damage, spend any number of tokens to roll that many d6s; reduce incoming damage by the total. In Melee range of the attacker, deal that much damage back to them.',
        isSelect: (table) => thornSkinSpendSelectOptions(table),
        onUse(table, chip) {
          const n = parseInt(String(chip.get('selectedId') ?? ''), 10);
          if (!Number.isFinite(n) || n < 1) return;
          const pool = table.feature.get('thornSkinTokens') ?? 0;
          if (n > pool) return;
          let total = 0;
          for (let i = 0; i < n; i++) {
            total += table.rollDie('d6');
          }
          const meId = table.me.instanceId;
          table.action.reducePendingDamageForTarget(meId, total);
          table.feature.set('thornSkinTokens', pool - n);
          const atk = table.action.attacker;
          if (atk && table.me.rangeFrom(atk) === 'melee') {
            atk.markHP(total);
          }
        },
      }
    ),
  ],
  hooks: {
    onRest(table) {
      table.feature.set('thornSkinTokens', 0);
    },
  },
};
