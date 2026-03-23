/**
 * Blade domain — Blade-Touched (Tier 2 / Level 7)
 * SRD: daggerheart-srd/abilities/Blade-Touched.md
 */

import { when, isActing } from '../../engine/when.js';

function bladeDomainCardsInLoadout(table) {
  const lo = table.me?.domainLoadout ?? [];
  if (!Array.isArray(lo)) return 0;
  return lo.filter((c) => c && String(c.domain || '').toLowerCase() === 'blade').length;
}

function bladeTouchedActive(table) {
  return bladeDomainCardsInLoadout(table) >= 4;
}

export const BladeTouched = {
  name: 'Blade-Touched',
  description:
    'When 4 or more of the domain cards in your loadout are from the Blade domain, gain the following benefits:\n\n- +2 bonus to your attack rolls\n- +4 bonus to your Severe damage threshold',
  passiveStatMods: when(bladeTouchedActive, {
    severeThreshold: 4,
  }),
  hooks: {
    onIntent: when(
      isActing,
      bladeTouchedActive,
      (table) => table.action?.type === 'attack',
      (table) => {
        table.rolls?.action?.addStatic?.({ name: 'Blade-Touched', value: 2 });
      }
    ),
  },
};
