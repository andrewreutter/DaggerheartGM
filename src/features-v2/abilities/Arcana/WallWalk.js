/**
 * Arcana domain spell — SRD: daggerheart-srd/abilities/Wall Walk.md
 */

export const WallWalk = {
  name: 'Wall Walk',
  description:
    '**Spend a Hope** to allow a creature you can touch to climb on walls and ceilings as easily as walking on the ground. This lasts until the end of the scene or you cast Wall Walk again',
  chips: [
    {
      placements: ['card'],
      hopeCost: 1,
      description: 'Grant a touched creature wall-climbing until the scene ends or you cast Wall Walk again.',
      onUse(table) {
        table.feature.set('wallWalkActive', true);
        table.me.actionLoop(
          'Wall Walk',
          'Spend Hope: choose a creature you can touch. They climb walls and ceilings like ground until the scene ends or you cast Wall Walk again (GM moves tokens as needed).'
        );
      },
    },
  ],
};
