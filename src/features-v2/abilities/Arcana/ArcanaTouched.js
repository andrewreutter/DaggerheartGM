/**
 * Arcana domain — Arcana-Touched (Tier 2)
 * SRD: With 4+ Arcana domain cards in loadout: +1 Spellcast rolls; once per rest swap Hope and Fear dice.
 */

import { when } from '../../engine/when.js';

/** Count Arcana domain cards in the active loadout (`domain` on each card, case-insensitive). */
function arcanaDomainCardsInLoadout(table) {
  const lo = table.me?.domainLoadout ?? [];
  if (!Array.isArray(lo)) return 0;
  return lo.filter((c) => c && String(c.domain || '').toLowerCase() === 'arcana').length;
}

function arcanaTouchedActive(table) {
  return arcanaDomainCardsInLoadout(table) >= 4;
}

function traitBonus(table, traitKey) {
  return arcanaTouchedActive(table) && table.me?.spellcastTrait === traitKey ? 1 : 0;
}

export const ArcanaTouched = {
  name: 'Arcana-Touched',
  description:
    'When 4 or more of the domain cards in your loadout are from the Arcana domain, gain the following benefits: +1 bonus to your Spellcast Rolls. Once per rest, you can switch the results of your Hope and Fear Dice.',
  passiveStatMods: when(arcanaTouchedActive, {
    agility: (table) => traitBonus(table, 'agility'),
    strength: (table) => traitBonus(table, 'strength'),
    finesse: (table) => traitBonus(table, 'finesse'),
    instinct: (table) => traitBonus(table, 'instinct'),
    presence: (table) => traitBonus(table, 'presence'),
    knowledge: (table) => traitBonus(table, 'knowledge'),
  }),
  chips: [
    when(arcanaTouchedActive, {
      name: 'Arcana-Touched — Swap Duality',
      placements: ['reviewAction'],
      frequency: 'rest',
      description: 'Once per rest, switch the results of your Hope and Fear dice on this roll.',
      onUse(table) {
        table.rolls?.action?.swapHopeFear?.();
      },
    }),
  ],
};
