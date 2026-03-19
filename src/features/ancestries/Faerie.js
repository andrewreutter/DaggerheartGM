/**
 * Faerie ancestry builder.
 *
 * Features:
 *   Luckbender — Once per session, spend 3 Hope to reroll both duality dice (onBanner chip).
 *   Wings — When you're flying and the attack targets you, mark 1 Stress to treat the attack as a miss (onBanner chip).
 */
export default {
  name: 'Faerie',
  description: 'Faeries are small, winged humanoids with a strong connection to luck and the fey. They are known for their capricious nature and ability to bend fortune.',

  features: [
    {
      name: 'Luckbender',
      description: 'Once per session, you can **spend 3 Hope** to reroll both your Hope and Fear dice.',
      onBanner(banner) {
        banner.addChip({
          label: 'Spend 3 Hope to reroll both duality dice (Luckbender)',
          hopeCost: 3,
          resetsOn: 'session',
          isVisible: (roll) => roll.isMine && roll.hasDuality,
          onChipAck(roll) { roll.reroll('Duality'); },
        });
      },
    },
    {
      name: 'Wings',
      description: 'You have wings and can fly. When an attack would target you while you are flying, you can **mark a Stress** to treat the attack as a miss.',
      onBanner(banner) {
        banner.addChip({
          label: 'Mark 1 Stress to treat this attack as a miss (Wings)',
          stressCost: 1,
          isVisible: (roll, character) => roll.hasDamage && !!character.faerieWingsFlying,
          onChipAck(roll, character, ctx) {
            ctx.setTreatAsMissForTarget(character.instanceId);
          },
        });
      },
    },
  ],
};
