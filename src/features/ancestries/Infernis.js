/**
 * Infernis ancestry — feature hooks keyed by feature name.
 *
 * SRD (ancestry): Infernis are humanoids who possess sharp canine teeth, pointed ears, and horns. They are the
 * descendants of demons from the Circles Below. Infernis possess a "dread visage" that manifests both involuntarily
 * and purposefully. On average, infernis live up to 350 years.
 *
 * SRD (Fearless): When you roll with Fear, you can **mark 2 Stress** to change it into a roll with Hope instead.
 *
 * SRD (Dread Visage): You have advantage on rolls to intimidate hostile creatures.
 */
export default {
  Fearless: {
    chips: [
      {
        placement: 'banner',
        label: 'Mark 2 stress to change Fear to Hope',
        stressCost: 2,
        isVisible: (ctx) => ctx.roll.isMine && ctx.roll.isWithFear,
        onChipAck: ({ roll }) => roll.setWithHope(),
      },
    ],
  },
  'Dread Visage': {
    advantageTriggers: ['intimidate hostile creatures'],
  },
};
