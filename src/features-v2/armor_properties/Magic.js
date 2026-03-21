import { when, isTargeted, hasPhysicalDamage } from '../engine/when.js';

export const Magic = {
  name: 'Magic',
  description: "You can't mark an Armor Slot to reduce physical damage.",
  hooks: {
    onReviewAction: when(
      isTargeted,
      hasPhysicalDamage,
      (table) => {
        const physicalDamage = table.action?.effects?.find(
          (e) =>
            e.type === 'damage' &&
            e.target?.instanceId === table.me?.instanceId &&
            e.damageType === 'physical' &&
            e.amount != null &&
            e.amount > 0
        );
        if (!physicalDamage) return;
        physicalDamage.armorSlotReductionDisallowed = true;
      }
    ),
  },
};
