/**
 * Dwarf ancestry — feature hooks keyed by feature name.
 *
 * SRD (ancestry): Dwarves are most easily recognized as short humanoids with square frames, dense musculature, and
 * thick hair. Their skin and nails contain a high amount of keratin, making them naturally resilient. Typically,
 * dwarves live up to 250 years of age.
 *
 * SRD (Thick Skin): When you take Minor damage, you can **mark 2 Stress** instead of marking a Hit Point.
 *
 * SRD (Increased Fortitude): **Spend 3 Hope** to halve incoming physical damage.
 */
export default {
  'Thick Skin': {
    chips: [
      {
        placement: 'banner',
        label: 'Mark 2 Stress instead of 1 HP for Minor damage',
        stressCost: 2,
        isVisible: (ctx) => ctx.roll.target.isMe && ctx.roll.hpLoss === 1,
        onChipAck: ({ roll }) => roll.reduceHPLoss(1),
      },
    ],
  },
  'Increased Fortitude': {
    chips: [
      {
        placement: 'banner',
        label: 'Spend 3 Hope to halve damage',
        hopeCost: 3,
        isVisible: (ctx) => ctx.roll.target.isMe && ctx.roll.dmgType === 'phy',
        onChipAck: ({ roll }) => roll.setDamageTotal(roll.damageTotal / 2),
        damageModifierWhenActive: { hopeCost: 3, dmgType: 'phy', apply: (total) => Math.ceil(total / 2) },
      },
    ],
  },
};
