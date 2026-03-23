/**
 * SRD item — Ring of Resistance (roll table 32).
 * Once per long rest: after a successful hit, toggle to halve incoming damage (reviewAction).
 */

import { when, anAttackSucceeds, againstYou, hasDamage } from '../engine/when.js';

export const RingOfResistance = {
  name: 'Ring of Resistance',
  description:
    'Once per long rest, you can activate this ring after a successful attack against you to halve the damage.',
  chips: [
    when(anAttackSucceeds, againstYou, hasDamage, {
      placements: ['reviewAction'],
      frequency: 'longRest',
      isToggle: true,
    }),
  ],
  hooks: {
    onReviewAction(table) {
      const id = table.me?.instanceId;
      if (!id) return;
      for (const e of table.action?.effects ?? []) {
        if (
          e.type === 'damage' &&
          e.target?.instanceId === id &&
          typeof e.amount === 'number' &&
          e.amount > 0
        ) {
          e.amount = Math.floor(e.amount / 2);
        }
      }
    },
  },
};
