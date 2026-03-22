/**
 * Seaborne community — feature hooks keyed by feature name.
 *
 * SRD (community): Being part of a seaborne community means you lived on or near a large body of water. Seaborne
 * communities are built, both physically and culturally, around the specific waters they call home. Seaborne learn to
 * fish at a young age, and train from birth to hold their breath and swim.
 *
 * SRD (Know the Tide): You can sense the ebb and flow of life. When you roll with Fear, place a token on your community
 * card. You can hold a number of tokens equal to your level. Before you make an action roll, you can spend any number
 * of these tokens to gain a +1 bonus to the roll for each token spent. At the end of each session, clear all unspent tokens.
 */
export default {
  'Know the Tide': {
    chips: [
      {
        placement: 'banner',
        label: 'Place a token on your community card (Know the Tide)',
        isVisible: (ctx) => ctx.roll.isMine && ctx.roll.isWithFear,
        onBannerAck({ featureState, character }) {
          const current = featureState.get('tokens', 0);
          const level = character.level ?? 1;
          const cap = Math.max(1, level);
          featureState.set('tokens', Math.min(current + 1, cap));
        },
      },
      {
        placement: 'preroll',
        label: 'Spend 1 token for +1 to this roll (Know the Tide)',
        isVisible: (ctx) => (ctx.roll.isMine && ctx.feature ? ctx.feature.get('tokens', 0) : 0),
        onUse({feature, roll}) {
          feature.set('tokens', feature.get('tokens', 0) - 1);
          roll.addRollBonus(1);
        },
      },
    ],
    onSessionStart({ feature }) {
      feature?.set('tokens', 0);
    },
  },
};
