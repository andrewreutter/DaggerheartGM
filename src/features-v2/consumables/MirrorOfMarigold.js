/**
 * SRD consumable — Mirror of Marigold (common roll table 59).
 * daggerheart-srd/consumables/Mirror of Marigold.md
 */

import { when, isTargeted, hasDamage } from '../engine/when.js';

function negateDamageToMe(table) {
  const id = table.me?.instanceId;
  if (!id) return;
  for (const e of table.action?.effects ?? []) {
    if (
      e.type === 'damage' &&
      e.target?.instanceId === id &&
      typeof e.amount === 'number' &&
      e.amount > 0
    ) {
      e.amount = 0;
    }
  }
}

export const MirrorOfMarigold = {
  name: 'Mirror of Marigold',
  description:
    'When you take damage, you can spend a Hope to negate that damage, after which the mirror shatters.',
  chips: [
    when(isTargeted, hasDamage, {
      name: 'Mirror of Marigold',
      placements: ['reviewAction'],
      hopeCost: 1,
      description: 'Spend 1 Hope to negate this damage; the mirror shatters.',
      onUse(table) {
        negateDamageToMe(table);
        table.me.inventory.remove('Mirror of Marigold');
      },
    }),
  ],
};
