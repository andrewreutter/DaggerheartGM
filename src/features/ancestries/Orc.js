/**
 * Orc ancestry — feature hooks keyed by feature name.
 *
 * SRD (ancestry): Orcs are humanoids most easily recognized by their square features and boar-like tusks that protrude
 * from their lower jaw. Orcs typically live for 125 years. Their average height ranges from 5 feet to 6 ½ feet.
 *
 * SRD (Sturdy): When you have 1 Hit Point remaining, attacks against you have disadvantage.
 *
 * SRD (Tusks): When you succeed on an attack against a target within Melee range, you can **spend a Hope** to gore the
 * target with your tusks, dealing an extra **1d6** damage.
 */
export default {
  Sturdy: {
    onTargeted: ({ roll, character }) => character.currentHp === 1 && roll.addDisadvantage(),
  },
  Tusks: {
    chips: [
      {
        placement: 'banner',
        label: 'Spend 1 Hope for +1d6 damage (Tusks)',
        hopeCost: 1,
        isVisible: (ctx) => ctx.roll.attacker && ctx.roll.attacker.isMe && ctx.roll.isSuccess && ctx.roll.attackRange === 'Melee',
        onChipAck({ banner }) {
          banner.addDamage('1d6');
        },
      },
    ],
  },
};
