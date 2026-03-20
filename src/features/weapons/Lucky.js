/**
 * SRD: On a failed attack, you can mark a Stress to reroll your attack.
 */
export default {
  name: 'Lucky',
  description: 'On a failed attack, mark a Stress to reroll your attack.',
  showTag: true,
  automated: false,
  tagText: 'Mark Stress to reroll on failure',
  chips: [
    {
      placement: 'banner',
      label: 'Mark 1 Stress to reroll your attack (Lucky)',
      stressCost: 1,
      isVisible: (ctx) => ctx.roll.isMine && ctx.roll.isFailure,
      onChipAck: ({ roll }) => roll.fullReroll(),
    },
  ],
};
