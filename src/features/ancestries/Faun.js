/**
 * Faun ancestry — feature hooks keyed by feature name.
 *
 * SRD (ancestry): Fauns resemble humanoid goats with curving horns, square pupils, and cloven hooves. The majority of
 * fauns have proportionately long limbs and are known for their ability to deliver powerful blows with their split hooves.
 * Fauns live for roughly 225 years.
 *
 * SRD (Caprine Leap): You can leap anywhere within Close range as though you were using normal movement, allowing you
 * to vault obstacles, jump across gaps, or scale barriers with ease.
 *
 * SRD (Kick): When you succeed on an attack against a target within Melee range, you can **mark a Stress** to kick
 * yourself off them, dealing an extra **2d6** damage and knocking back either yourself or the target to Very Close range.
 */
export default {
  'Caprine Leap': {},
  Kick: {
    chips: [
      {
        placement: 'banner',
        label: 'Mark 1 Stress for +2d6 and knockback',
        stressCost: 1,
        isVisible: (ctx) => ctx.roll.attacker && ctx.roll.attacker.isMe && ctx.roll.isSuccess && ctx.roll.attackRange === 'Melee',
        onChipAck({ roll, character, banner }) {
          banner.addDamage('2d6');
          banner.addNarration(`${character.name} or ${roll.target.name} is knocked back to Very Close range`);
        },
      },
    ],
  },
};
