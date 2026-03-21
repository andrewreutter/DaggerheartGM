import { when, isTargeted, hasMagicDamage } from '../engine/when.js';

export const Warded = {
  name: "Warded",
  description:
    "You reduce incoming magic damage by your Armor Score before applying it to your damage thresholds.",
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
        const score = table.me?.armorScore ?? 0;
        magicDamage.amount = Math.max(0, magicDamage.amount - score);
      }
    ),
  },
};
