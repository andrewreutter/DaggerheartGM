/**
 * Arcana domain spell — SRD: daggerheart-srd/abilities/Floating Eye.md
 */

export const FloatingEye = {
  name: 'Floating Eye',
  description:
    "**Spend a Hope** to create a single, small floating orb that you can move anywhere within Very Far range. While this spell is active, you can see through the orb as though you're looking out from its position. You can transition between using your own senses and seeing through the orb freely. If the orb takes damage or moves out of range, the spell ends.",
  chips: [
    {
      placements: ['card'],
      hopeCost: 1,
      description: 'Create a Very Far–range sensor orb; switch between your senses and the orb.',
      onUse(table) {
        table.feature.set('floatingEyeActive', true);
        table.me.actionLoop(
          'Floating Eye',
          'Place a small orb anywhere within Very Far range. You may see through it or use your own senses freely. The spell ends if the orb is damaged or leaves range.'
        );
      },
    },
  ],
};
