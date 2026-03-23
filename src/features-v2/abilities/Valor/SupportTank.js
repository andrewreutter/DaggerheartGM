/**
 * Valor domain — Support Tank (Tier 2)
 * SRD: When an ally within Close range fails a roll, you can spend 2 Hope to allow them to reroll either their Hope or Fear Die.
 */

import { when } from '../../engine/when.js';

/** SRD “within Close range” on the map: Melee, Very Close, or Close bands (see HealingStrike, Sigil of Retribution). */
function withinCloseRangeBand(band) {
  return band === 'melee' || band === 'veryClose' || band === 'close';
}

function allyFailedWithinCloseRange(table) {
  if (table.me.isActing) return false;
  const actor = table.action?.actor;
  if (!actor?.isCharacter) return false;
  if (actor.instanceId === table.me.instanceId) return false;
  if (table.rolls?.action?.isSuccess !== false) return false;
  const band = table.me.rangeFrom(actor);
  return withinCloseRangeBand(band);
}

export const SupportTank = {
  name: 'Support Tank',
  description:
    'When an ally within Close range fails a roll, you can spend 2 Hope to allow them to reroll either their Hope or Fear Die.',
  chips: [
    when(allyFailedWithinCloseRange, {
      name: 'Support Tank — Reroll Hope',
      placements: ['reviewAction'],
      hopeCost: 2,
      description: 'Spend 2 Hope: your ally rerolls their Hope Die.',
      onUse(table) {
        table.rolls?.action?.hopeDie?.reroll();
      },
    }),
    when(allyFailedWithinCloseRange, {
      name: 'Support Tank — Reroll Fear',
      placements: ['reviewAction'],
      hopeCost: 2,
      description: 'Spend 2 Hope: your ally rerolls their Fear Die.',
      onUse(table) {
        table.rolls?.action?.fearDie?.reroll();
      },
    }),
  ],
};
