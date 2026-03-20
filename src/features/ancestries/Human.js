/**
 * Human ancestry — feature hooks keyed by feature name.
 *
 * SRD (ancestry): Humans are most easily recognized by their dexterous hands, rounded ears, and bodies built for
 * endurance. Their average height ranges from just under 5 feet to about 6 ½ feet. In general, humans live to an age
 * of about 100.
 *
 * SRD (High Stamina): Gain an additional Stress slot at character creation.
 *
 * SRD (Adaptability): When you fail a roll that utilized one of your Experiences, you can **mark a Stress** to reroll.
 */
export default {
  'High Stamina': {
    passiveStatMods: { maxStress: 1 },
  },
  Adaptability: {
    chips: [
      {
        placement: 'banner',
        label: 'Mark 1 Stress to reroll the entire roll (Adaptability)',
        stressCost: 1,
        isVisible: (ctx) => ctx.roll.isMine && ctx.roll.hasExperience && ctx.roll.isFailure,
        onChipAck: ({ roll }) => roll.fullReroll(),
      },
    ],
  },
};
