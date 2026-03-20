/**
 * Clank ancestry — feature hooks keyed by feature name.
 *
 * SRD (ancestry): Clanks are sentient mechanical beings built from a variety of materials. Many clanks embrace body
 * modifications for style as well as function. A clank's lifespan extends as long as they're able to acquire or craft
 * new parts, making their physical form effectively immortal.
 *
 * SRD (Purposeful Design): Decide who made you and for what purpose. At character creation, choose one of your
 * Experiences that best aligns with this purpose and gain a permanent +1 bonus to it.
 *
 * SRD (Efficient): When you take a short rest, you can choose a long rest move instead of a short rest move.
 */
export default {
  'Purposeful Design': {
    experienceBonus: 1,
  },
  Efficient: {
    onRest(ctx) {
      ctx.rest.longMoves.forEach(m => ctx.rest.addShortMove(m));
    },
  },
};
