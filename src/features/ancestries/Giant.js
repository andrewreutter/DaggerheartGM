/**
 * Giant ancestry builder.
 *
 * Features:
 *   Endurance — Gain +1 HP slot at character creation.
 *   Reach     — Melee weapons (and abilities) have their range extended to Very Close.
 */
export default {
  name: 'Giant',
  description: 'Giants are towering humanoids with broad shoulders, long arms, and one to three eyes. Adult giants range from 6 ½ to 8 ½ feet tall and are naturally muscular, regardless of body type. They are easily recognized by their wide frames and elongated arms and necks. Though they can have up to three eyes, all giants are born with none and remain sightless for their first year of life. Until a giant reaches the age of 10 and their features fully develop, the formation of their eyes may fluctuate. Those with a single eye are commonly known as cyclops. The average giant lifespan is about 75 years.',

  onCharacterBuild(char) {
    char.addFeature(
      'Endurance',
      'Gain an additional Hit Point slot at character creation.',
      {
        onCharacterRender(ctx) {
          ctx.addStatMod('maxHp', 1);
        },
      }
    );

    char.addFeature(
      'Reach',
      'Treat any weapon, ability, spell, or other feature that has a Melee range as though it has a Very Close range instead.',
      {
        onCharacterRender(ctx) {
          for (const w of ctx.weapons) {
            if (w.range === 'Melee') {
              w.range = 'Very Close';
              w.effectiveRange = 'Very Close';
            }
          }
        },
      }
    );
  },
};
