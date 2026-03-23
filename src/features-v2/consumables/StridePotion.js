/**
 * SRD consumable — Stride Potion (common roll table 01).
 * daggerheart-srd/consumables/Stride Potion.md
 */

import { when, isActing } from '../engine/when.js';

const PENDING_KEY = 'pendingNextAgilityRoll';

function isAgilityTrait(table) {
  return String(table.action?.trait || '').toLowerCase() === 'agility';
}

export const StridePotion = {
  name: 'Stride Potion',
  description: 'You gain a +1 bonus to your next Agility Roll.',
  onUse(table) {
    table.feature.set(PENDING_KEY, true);
  },
  hooks: {
    onIntent: when(
      isActing,
      (t) => t.rolls?.action != null,
      isAgilityTrait,
      (t) => t.feature.get(PENDING_KEY) === true,
      (table) => {
        table.rolls.action.addStatic({ name: 'Stride Potion', value: 1 });
        table.feature.set(PENDING_KEY, false);
      }
    ),
  },
};
