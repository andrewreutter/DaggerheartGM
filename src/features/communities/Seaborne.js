/**
 * Seaborne community builder.
 *
 * Features:
 *   Know the Tide — Fear rolls add token (banner chip); spend 1 token for +1 (onAct canvas chip); session clear via onSessionStart.
 */
export default {
  name: 'Seaborne',
  description: 'Being part of a seaborne community means you lived on or near a large body of water. Seaborne communities are built, both physically and culturally, around the specific waters they call home. Some of these groups live along the shore, constructing ports for locals and travelers alike. These harbors function as centers of commerce, tourist attractions, or even just a safe place to lay down one\'s head after weeks of travel. Other seaborne live on the water in small boats or large ships, with the idea of "home" comprising a ship and its crew, rather than any one landmass. No matter their exact location, seaborne communities are closely tied to the ocean tides and the creatures who inhabit them. Seaborne learn to fish at a young age, and train from birth to hold their breath and swim in even the most tumultuous waters. Individuals from these groups are highly sought after for their sailing skills, and many become captains of vessels, whether within their own community, working for another, or even at the helm of a powerful naval operation.',

  features: [
    {
      name: 'Know the Tide',
      description: "You can sense the ebb and flow of life. When you roll with Fear, place a token on your community card. You can hold a number of tokens equal to your level. Before you make an action roll, you can spend any number of these tokens to gain a +1 bonus to the roll for each token spent. At the end of each session, clear all unspent tokens.",
      onBanner(banner) {
        banner.addChip({
          label: 'Place a token on your community card (Know the Tide)',
          isVisible: (roll) => roll.isMine && roll.isWithFear,
          onBannerAck(roll, character, ctx, feature) {
            const current = feature.get('tokens', 0);
            const level = character.level ?? 1;
            const cap = Math.max(1, level);
            feature.set('tokens', Math.min(current + 1, cap));
          },
        });
      },
      onAct(ctx) {
        ctx.canvas.addChip({
          label: 'Spend 1 token for +1 to this roll (Know the Tide)',
          isVisible: (r, feature) => (r.isMine && feature ? feature.get('tokens', 0) : 0),
          onUse(r, feature) {
            feature.set('tokens', feature.get('tokens', 0) - 1);
            r.addRollBonus(1);
          },
        });
      },
      onSessionStart(feature) {
        feature.set('tokens', 0);
      },
    },
  ],
};
