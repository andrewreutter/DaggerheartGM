/**
 * SRD consumable — Charm Potion (common roll table 05).
 * daggerheart-srd/consumables/Charm Potion.md
 */

import { when, isActing } from '../engine/when.js';

const PENDING_KEY = 'pendingNextPresenceRoll';

function isPresenceTrait(table) {
  return String(table.action?.trait || '').toLowerCase() === 'presence';
}

export const CharmPotion = {
  name: 'Charm Potion',
  description: 'You gain a +1 bonus to your next Presence Roll.',
  onUse(table) {
    table.feature.set(PENDING_KEY, true);
  },
  hooks: {
    onIntent: when(
      isActing,
      (t) => t.rolls?.action != null,
      isPresenceTrait,
      (t) => t.feature.get(PENDING_KEY) === true,
      (table) => {
        table.rolls.action.addStatic({ name: 'Charm Potion', value: 1 });
        table.feature.set(PENDING_KEY, false);
      }
    ),
  },
};
