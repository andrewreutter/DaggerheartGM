/**
 * SRD: Mythic Aerial Hunter — daggerheart-srd/beastforms/Mythic Aerial Hunter.md
 */

import { when, isActing } from '../engine/when.js';

export const Carrier = {
  name: 'Carrier',
  description: 'You can carry up to three willing allies with you when you move.',
};

function hasDamageDice(table) {
  return (table.rolls?.damage?.dice?.length ?? 0) > 0;
}

/**
 * Proxy for “from at least Close range into Melee” using token positions: prior position was in the
 * Close, Far, or Very Far band vs the attack target, and the current position is Melee. Straight-line
 * movement is left to table play; the host supplies `_previousPositions` after a move.
 */
function isChargeFromAtLeastCloseIntoMelee(table) {
  const lp = table.me?.lastPosition;
  if (!lp) return false;
  const start = lp.rangeFromTarget;
  if (!start || start === 'melee' || start === 'veryClose') return false;
  return table.me.rangeFromTarget === 'melee';
}

export const DeadlyRaptor = {
  name: 'Deadly Raptor',
  description:
    'You can fly at will and move up to Far range as part of your action. When you move in a straight line into Melee range of a target from at least Close range and make an attack against that target in the same action, you can reroll all damage dice that rolled a result lower than your Proficiency.',
  movementModes: ['fly'],
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      isChargeFromAtLeastCloseIntoMelee,
      hasDamageDice,
      {
        placements: ['reviewAction'],
        description:
          'Reroll damage dice that rolled below your Proficiency (charging from at least Close range into Melee of this target).',
        onUse(table) {
          const prof = table.me.proficiency ?? 1;
          table.rolls?.damage?.rerollDiceBelow?.(prof);
        },
      }
    ),
  ],
};

export const features = [Carrier, DeadlyRaptor];
