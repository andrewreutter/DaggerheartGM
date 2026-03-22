/**
 * Bone domain — Brace (Tier 1)
 * SRD: When you mark an Armor Slot to reduce incoming damage, you can mark a Stress to mark an additional Armor Slot.
 */

import { when, armorUseCommitted } from '../../engine/when.js';

export const Brace = {
  name: 'Brace',
  description:
    'When you mark an Armor Slot to reduce incoming damage, you can mark a Stress to mark an additional Armor Slot.',
  chips: [
    when(armorUseCommitted, {
      name: 'Brace',
      placements: ['reviewAction'],
      stressCost: 1,
      description:
        'Mark a Stress to mark an additional Armor Slot on this hit (further reduces damage per SRD).',
      onUse(table) {
        table.me.markArmor(1);
      },
    }),
  ],
};
