/**
 * Valor domain — Body Basher (Tier 1)
 * SRD: On a successful attack with a Melee-range weapon, add your Strength to damage.
 */

import { when, isActing } from '../../engine/when.js';

export const BodyBasher = {
  name: 'Body Basher',
  description:
    'You use the full force of your body in a fight. On a successful attack using a weapon with a Melee range, gain a bonus to your damage roll equal to your Strength.',
  hooks: {
    onIntent: when(
      isActing,
      (t) => t.rolls?.damage != null,
      (t) => t.rolls?.action?.isSuccess === true,
      (t) => t.action?.type === 'attack',
      (t) => t.action?.range === 'melee',
      (t) => {
        const str = t.me?.traits?.strength ?? 0;
        if (str > 0) {
          t.rolls.damage.addStatic({ name: 'Body Basher', value: str });
        }
      }
    ),
  },
};
