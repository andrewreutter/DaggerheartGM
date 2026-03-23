/**
 * SRD consumable — Control Potion (common roll table 03).
 * daggerheart-srd/consumables/Control Potion.md
 */

import { when, isActing } from '../engine/when.js';

const PENDING_KEY = 'pendingNextFinesseRoll';

function isFinesseTrait(table) {
  return String(table.action?.trait || '').toLowerCase() === 'finesse';
}

export const ControlPotion = {
  name: 'Control Potion',
  description: 'You gain a +1 bonus to your next Finesse Roll.',
  onUse(table) {
    table.feature.set(PENDING_KEY, true);
  },
  hooks: {
    onIntent: when(
      isActing,
      (t) => t.rolls?.action != null,
      isFinesseTrait,
      (t) => t.feature.get(PENDING_KEY) === true,
      (table) => {
        table.rolls.action.addStatic({ name: 'Control Potion', value: 1 });
        table.feature.set(PENDING_KEY, false);
      }
    ),
  },
};
