/**
 * Sage domain — Fane of the Wilds (Tier 3 / SRD level 9)
 * SRD: daggerheart-srd/abilities/Fane of the Wilds.md
 *
 * Long rest: tokens = count of Sage domain cards in loadout + vault (replaces prior pool).
 * Spellcast Review: spend any number of tokens for +1 to the Spellcast Roll each (after the roll).
 * Crit on a Sage domain Spellcast: gain 1 token (host sets `action.abilityId` to the cast card id).
 */

import { when, isActing } from '../../engine/when.js';

function countSageDomainCards(table) {
  const lo = table.me?.domainLoadout ?? [];
  const vault = table.me?.domainVault ?? [];
  const n = (arr) =>
    arr.filter((c) => c && String(c.domain || '').toLowerCase() === 'sage').length;
  return n(lo) + n(vault);
}

/** True when the cast card id matches a Sage domain card in loadout or vault. */
function isCastingSageDomainSpell(table) {
  const aid = table.action?.abilityId;
  if (!aid) return false;
  const all = [...(table.me?.domainLoadout ?? []), ...(table.me?.domainVault ?? [])];
  const card = all.find((c) => c && String(c.id) === String(aid));
  return Boolean(card && String(card.domain || '').toLowerCase() === 'sage');
}

function faneSpendOptions(table) {
  const n = table.feature.get('faneWildsTokens') ?? 0;
  if (n < 1) return [];
  return Array.from({ length: n + 1 }, (_, i) => ({
    id: String(i),
    name: i === 0 ? 'Spend no tokens' : `Spend ${i} token${i === 1 ? '' : 's'} (+${i} to Spellcast roll)`,
    description:
      i === 0
        ? 'Do not add a bonus from Fane of the Wilds tokens.'
        : `Spend ${i} token${i === 1 ? '' : 's'} to gain +${i} to this Spellcast Roll.`,
  }));
}

export const FaneOfTheWilds = {
  name: 'Fane of the Wilds',
  description:
    'After a long rest, place a number of tokens equal to the number of Sage domain cards in your loadout and vault on this card.\n\nWhen you would make a Spellcast Roll, you can spend any number of tokens after the roll to gain a +1 bonus for each token spent.\n\nWhen you critically succeed on a Spellcast Roll for a Sage domain spell, gain a token.\n\nWhen you take a long rest, clear all unspent tokens.',
  hooks: {
    onRest: when(
      (t) => t.action?.type === 'longRest',
      (table) => {
        table.feature.set('faneWildsTokens', countSageDomainCards(table));
      }
    ),
    onReviewAction: when(
      isActing,
      (t) => t.action?.type === 'spellcast',
      (t) => t.rolls?.action?.isCritical === true,
      isCastingSageDomainSpell,
      (table) => {
        const cur = table.feature.get('faneWildsTokens') ?? 0;
        table.feature.set('faneWildsTokens', cur + 1);
      }
    ),
  },
  chips: [
    when(
      isActing,
      (t) => t.action?.type === 'spellcast',
      (t) => t.rolls?.action != null,
      (t) => (t.feature.get('faneWildsTokens') ?? 0) > 0,
      {
        name: 'Fane of the Wilds',
        placements: ['reviewAction'],
        isSelect: (table) => faneSpendOptions(table),
        isDisabled: (table) =>
          faneSpendOptions(table).length < 1 ? 'No valid spend option (check Hope and targets).' : false,
        description:
          'After your Spellcast Roll, spend any number of tokens to gain +1 to the roll for each token spent.',
        onUse(table, chip) {
          const raw = chip.get?.('selectedId');
          const spend = Math.max(0, Math.floor(Number(raw)) || 0);
          const cur = table.feature.get('faneWildsTokens') ?? 0;
          if (spend < 0 || spend > cur) return;
          if (!table.rolls?.action?.addStatic) return;
          table.feature.set('faneWildsTokens', cur - spend);
          if (spend > 0) {
            table.rolls.action.addStatic({ name: 'Fane of the Wilds', value: spend });
          }
        },
      }
    ),
  ],
};
