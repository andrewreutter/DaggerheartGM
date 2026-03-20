/**
 * Elf ancestry — feature hooks keyed by feature name.
 *
 * SRD (ancestry): Elves are typically tall humanoids with pointed ears and acutely attuned senses. All elves have the
 * ability to drop into a celestial trance, rather than sleep. Because elves live for about 350 years, their traits can
 * shift more than once throughout their lifespan.
 *
 * SRD (Quick Reactions): **Mark a Stress** to gain advantage on a reaction roll.
 *
 * SRD (Celestial Trance): During a rest, you can drop into a trance to choose an additional downtime move.
 */
export default {
  'Quick Reactions': {
    chips: [
      {
        placement: 'preroll',
        label: 'Mark a stress to gain advantage on this reaction roll',
        stressCost: 1,
        isVisible: (ctx) => ctx.roll.isMine && ctx.roll.isReaction,
        onUse: ({roll}) => roll.addAdvantageDie('Quick Reactions'),
      },
    ],
  },
  'Celestial Trance': {
    onRest(ctx) {
      ctx.rest.addShortMoveSlot('Celestial Trance');
      ctx.rest.addLongMoveSlot('Celestial Trance');
    },
  },
};
