/**
 * Blade domain — Whirlwind (Tier 1)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { when, isActing } from '../../engine/when.js';

/** SRD: target within Very Close — includes Melee (≤5') and Very Close (≤10') bands. */
function successfulAttackVeryClose(table) {
  const r = table.me?.rangeFromTarget;
  return (
    table.action?.type === 'attack' &&
    table.rolls?.action?.isSuccess === true &&
    (r === 'veryClose' || r === 'melee')
  );
}

export const Whirlwind = {
  name: 'Whirlwind',
  description:
    'When you make a successful attack against a target within Very Close range, you can **spend a Hope** to use the attack against all other targets within Very Close range. All additional adversaries you succeed against with this ability take half damage.',
  chips: [
    when(
      isActing,
      successfulAttackVeryClose,
      {
        placements: ['reviewAction'],
        name: 'Whirlwind',
        hopeCost: 1,
        description:
          'Spend 1 Hope. Make your attack against each other target within Very Close; each additional adversary you succeed against takes half damage (GM resolves rolls and halving).',
        onUse(table) {
          table.me.actionLoop(
            'Whirlwind',
            'Spend 1 Hope. After a successful attack against a target within Very Close, attack each other adversary within Very Close. Each additional hit deals half damage.'
          );
        },
      }
    ),
  ],
};
