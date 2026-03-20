/**
 * Faerie ancestry — feature hooks keyed by feature name.
 *
 * SRD (ancestry): Faeries are winged humanoid creatures with insectile features. All faeries possess membranous wings
 * and they each go through a process of metamorphosis. The average height of a faerie ranges from about 2 feet to 5 feet.
 *
 * SRD (Luckbender): Once per session, after you or a willing ally within Close range makes an action roll, you can
 * **spend 3 Hope** to reroll the Duality Dice.
 *
 * SRD (Wings): You can fly. While flying, you can **mark a Stress** after an adversary makes an attack against you to
 * gain a +2 bonus to your Evasion against that attack.
 */
export default {
  Luckbender: {
    chips: [
      {
        placement: 'banner',
        label: 'Spend 3 Hope to reroll both duality dice (Luckbender)',
        hopeCost: 3,
        resetsOn: 'session',
        isVisible: (ctx) => ctx.roll.isMine && ctx.roll.hasDuality,
        onChipAck({ roll }) { roll.reroll('Duality'); },
      },
    ],
  },
  Wings: {
    chips: [
      {
        placement: 'banner',
        label: 'Mark 1 Stress to treat this attack as a miss (Wings)',
        stressCost: 1,
        isVisible: (ctx) => ctx.roll.hasDamage && !!ctx.character.faerieWingsFlying,
        onChipAck({ character, banner }) {
          banner.setTreatAsMissForTarget(character.instanceId);
        },
      },
    ],
  },
};
