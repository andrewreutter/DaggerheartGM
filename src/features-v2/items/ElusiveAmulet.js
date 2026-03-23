/**
 * SRD item — Elusive Amulet (roll table 38). daggerheart-srd/items/Elusive Amulet.md
 *
 * Once per long rest: activate to become Hidden until you move. Rogue **Cloaked** replaces
 * Hidden per class rules; movement ends this item’s concealment (and clears Cloaked while
 * the amulet’s tracker is active — overlaps with other Cloaked sources are rare).
 */

import { when } from '../engine/when.js';

export const ElusiveAmulet = {
  name: 'Elusive Amulet',
  description:
    'Once per long rest, you can activate this amulet to become Hidden until you move. While Hidden in this way, you remain unseen even if an adversary moves to where they would normally see you.',
  frequency: 'longRest',
  onUse(table) {
    table.feature.set('elusiveAmuletActive', true);
    table.me.addCondition('Hidden');
  },
  hooks: {
    onTokenMove: when(
      (table) => table.tokenMove?.mover?.instanceId === table.me?.instanceId,
      (table) => table.feature.get('elusiveAmuletActive') === true,
      (table) => {
        table.me.removeCondition('Hidden');
        table.me.removeCondition('Cloaked');
        table.feature.set('elusiveAmuletActive', false);
      }
    ),
  },
};
