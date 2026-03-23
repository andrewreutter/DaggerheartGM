/**
 * Splendor domain — Splendor-Touched (Tier 2 / Level 7)
 * SRD: daggerheart-srd/abilities/Splendor-Touched.md
 */

import { when, isTargeted } from '../../engine/when.js';

function splendorDomainCardsInLoadout(table) {
  const lo = table.me?.domainLoadout ?? [];
  if (!Array.isArray(lo)) return 0;
  return lo.filter((c) => c && String(c.domain || '').toLowerCase() === 'splendor').length;
}

function splendorTouchedActive(table) {
  return splendorDomainCardsInLoadout(table) >= 4;
}

function pendingHpAmountOnSelf(table) {
  const id = table.me?.instanceId;
  if (!id) return 0;
  const hpEffect = (table.action?.effects ?? []).find(
    (e) => e.stat === 'currentHP' && e.target?.instanceId === id && e.amount > 0
  );
  return hpEffect ? hpEffect.amount : 0;
}

function hasPendingSelfHpLoss(table) {
  return pendingHpAmountOnSelf(table) > 0;
}

function mitigationAvailable(table) {
  return !table.feature.get('splendorTouchedMitigateUsed');
}

export const SplendorTouched = {
  name: 'Splendor-Touched',
  description:
    'When 4 or more of the domain cards in your loadout are from the Splendor domain, gain the following benefits:\n\n- +3 bonus to your Severe damage threshold\n- Once per long rest, when incoming damage would require you to mark a number of Hit Points, you can choose to mark that much Stress or spend that much Hope instead.',
  passiveStatMods: when(splendorTouchedActive, {
    severeThreshold: 3,
  }),
  hooks: {
    onRest(table) {
      if (table.action?.type !== 'longRest') return;
      table.feature.set('splendorTouchedMitigateUsed', false);
    },
  },
  chips: [
    when(
      splendorTouchedActive,
      isTargeted,
      hasPendingSelfHpLoss,
      mitigationAvailable,
      {
        name: 'Splendor-Touched — Mitigate incoming HP',
        placements: ['reviewOutcome'],
        description:
          'Once per long rest, when you would mark Hit Points from this hit: choose to mark that much Stress instead, or spend that much Hope instead (no HP marked). Choose before resolving.',
        isSelect: () => [
          {
            id: 'stress',
            name: 'Mark Stress instead',
            description: 'Mark Stress boxes equal to the Hit Points you would have marked.',
          },
          {
            id: 'hope',
            name: 'Spend Hope instead',
            description: 'Spend Hope equal to the number of Hit Points you would have marked.',
          },
        ],
        isDisabled: (table) =>
          pendingHpAmountOnSelf(table) <= 0
            ? 'No pending Hit Point loss on you from this hit.'
            : false,
        onUse(table, chipState) {
          const choice = chipState?.get?.('selectedId');
          if (choice !== 'stress' && choice !== 'hope') return;
          const id = table.me?.instanceId;
          if (!id) return;
          const n = pendingHpAmountOnSelf(table);
          if (n <= 0) return;

          if (choice === 'stress') {
            table.action.convertPendingHpLossToStressOnTarget(id);
            table.feature.set('splendorTouchedMitigateUsed', true);
            return;
          }

          if ((table.me?.hope ?? 0) < n) return;
          const list = table.action?.effects ?? [];
          const hpEffect = list.find(
            (e) => e.stat === 'currentHP' && e.target?.instanceId === id && e.amount > 0
          );
          if (!hpEffect) return;
          hpEffect.amount = 0;
          table.me.spendHope(n);
          table.feature.set('splendorTouchedMitigateUsed', true);
        },
      }
    ),
  ],
};
