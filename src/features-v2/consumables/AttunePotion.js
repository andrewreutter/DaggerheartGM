/**
 * SRD consumable — Attune Potion (common roll table 04).
 * daggerheart-srd/consumables/Attune Potion.md
 */

import { when, isActing } from '../engine/when.js';

const PENDING_KEY = 'pendingNextInstinctRoll';

function isInstinctTrait(table) {
  return String(table.action?.trait || '').toLowerCase() === 'instinct';
}

export const AttunePotion = {
  name: 'Attune Potion',
  description: 'You gain a +1 bonus to your next Instinct Roll.',
  onUse(table) {
    table.feature.set(PENDING_KEY, true);
  },
  hooks: {
    onIntent: when(
      isActing,
      (t) => t.rolls?.action != null,
      isInstinctTrait,
      (t) => t.feature.get(PENDING_KEY) === true,
      (table) => {
        table.rolls.action.addStatic({ name: 'Attune Potion', value: 1 });
        table.feature.set(PENDING_KEY, false);
      }
    ),
  },
};
