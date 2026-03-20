/**
 * Katari ancestry — feature hooks keyed by feature name.
 *
 * SRD (ancestry): Katari are feline humanoids with retractable claws, vertically slit pupils, and high, triangular ears.
 * Their height ranges from about 3 feet to 6 ½ feet, and they live to around 150 years.
 *
 * SRD (Feline Instincts): When you make an Agility Roll, you can **spend 2 Hope** to reroll your Hope Die.
 *
 * SRD (Retracting Claws): Make an **Agility Roll** to scratch a target within Melee range. On a success, they become
 * temporarily _Vulnerable._
 */
export default {
  'Feline Instincts': {
    chips: [
      {
        placement: 'banner',
        label: 'Spend 2 Hope to reroll Hope Die',
        hopeCost: 2,
        isVisible: (ctx) => ctx.roll.isMine && ctx.roll.trait?.name === 'Agility',
        onChipAck: ({ roll }) => roll.reroll('Hope'),
      },
    ],
  },
  'Retracting Claws': {
    virtualWeapon: {
      trait: 'Agility',
      range: 'Melee',
      damage: null,
      description: 'On success, target becomes Vulnerable',
      onAcknowledge({ target, roll }) {
        if (roll?.isSuccess && target) target.setFlag('vulnerable', true);
      },
    },
  },
};
