import { when, isTargeted, hasMagicDamage } from '../engine/when.js';

export const Physical = {
  name: 'Physical',
  description: "You can't mark an Armor Slot to reduce magic damage.",
  hooks: {
    onReviewAction: when(
      isTargeted,
      hasMagicDamage,
      (table) => {
        const magicDamage = table.action?.effects?.find(
          (e) =>
            e.type === 'damage' &&
            e.target?.instanceId === table.me?.instanceId &&
            e.damageType === 'magic' &&
            e.amount != null &&
            e.amount > 0
        );
        if (!magicDamage) return;
        magicDamage.armorSlotReductionDisallowed = true;
      }
    ),
  },
};
