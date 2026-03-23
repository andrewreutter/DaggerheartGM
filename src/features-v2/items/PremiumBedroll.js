/**
 * SRD item — Premium Bedroll (daggerheart-srd/items/Premium Bedroll.md)
 */

export const PremiumBedroll = {
  name: 'Premium Bedroll',
  description: 'During downtime, you automatically clear a Stress.',
  hooks: {
    onRest(table) {
      table.me.clearStress(1);
    },
  },
};
