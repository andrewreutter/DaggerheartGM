/**
 * Dwarf Ancestry Features (V2)
 *
 * SRD source: daggerheart-srd/ancestries/Dwarf.md
 */

import { when, isTargeted, hasPhysicalDamage, youTakeMinorDamage } from '../engine/when.js';

export const ThickSkin = {
  name: 'Thick Skin',
  description:
    'When you take Minor damage, you can mark 2 Stress instead of marking a Hit Point.',
  chips: [
    when(
      isTargeted,
      youTakeMinorDamage,
      {
        description: 'Mark 2 Stress instead of marking 1 Hit Point.',
        placements: ['reviewOutcome'],
        stressCost: 2,
        isToggle: true,
        // No onUse — the engine gates the hook below
      }
    ),
  ],
  hooks: {
    onReviewOutcome: (table) => {
      const dmg = table.action?.effects?.find(
        (e) =>
          e.stat === 'currentHP' &&
          e.target?.instanceId === table.me?.instanceId
      );
      if (dmg) {
        dmg.amount = 0;
      }
    },
  },
};

export const IncreasedFortitude = {
  name: 'Increased Fortitude',
  description: 'Spend 3 Hope to halve incoming physical damage.',
  chips: [
    when(isTargeted, hasPhysicalDamage, {
      description: 'Spend 3 Hope to halve incoming physical damage.',
      placements: ['reviewAction'],
      hopeCost: 3,
      isToggle: true,
    }),
  ],
  hooks: {
    onReviewAction: (table) => {
      const dmg = table.action?.effects?.find(
        (e) =>
          e.type === 'damage' &&
          e.target?.instanceId === table.me?.instanceId &&
          e.damageType === 'physical'
      );
      if (dmg) {
        dmg.amount = Math.ceil(dmg.amount / 2);
      }
    },
  },
};
