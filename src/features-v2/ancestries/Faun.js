/**
 * Faun Ancestry Features (V2)
 *
 * SRD source: daggerheart-srd/ancestries/Faun.md
 */

import {
  when,
  youSucceedOnAnAttack,
  againstATargetWithinMeleeRange,
} from '../engine/when.js';

/** Map positions at melee, **or** melee-range weapon from the bridge when positions are unknown. */
function kickAgainstTargetInMelee(table) {
  return againstATargetWithinMeleeRange(table) || table.action?.range === 'melee';
}

/** Passed to `move(..., { freezeReason })` — host locks the non-mover until ack/cancel. */
const KICK_MAP_MOVE_LOCK = 'Kick: pending map position';

export const CaprineLeap = {
  name: 'Caprine Leap',
  description:
    'You can leap anywhere within Close range as though you were using normal movement, allowing you to vault obstacles, jump across gaps, or scale barriers with ease.',
  // Purely narrative feature - no mechanical effect
};

export const Kick = {
  name: 'Kick',
  description:
    'When you succeed on an attack against a target within Melee range, you can mark a Stress to kick yourself off them, dealing an extra 2d6 damage and knocking back either yourself or the target to Very Close range.',
  chips: [
    when(
      youSucceedOnAnAttack,
      kickAgainstTargetInMelee,
      {
        name: 'Kick (push target)',
        description:
          'Mark 1 Stress to deal an extra 2d6 damage and knock the target to Very Close range.',
        placements: ['reviewAction'],
        stressCost: 1,
        onUse(table) {
          table.rolls?.damage?.addDie({ name: 'Kick', die: '2d6' });
          table.action?.target?.move(
            (t) => t.action.target?.rangeFrom(t.action.attacker) === 'veryClose',
            'Very Close range from attacker',
            'Kick: knock target to Very Close range.',
            {
              freezeOtherInstanceId: table.me?.instanceId,
              freezeReason: KICK_MAP_MOVE_LOCK,
              rehydrateKey: 'faun.kick.push',
            }
          );
        },
      }
    ),
    when(
      youSucceedOnAnAttack,
      kickAgainstTargetInMelee,
      {
        name: 'Kick (leap back)',
        description:
          'Mark 1 Stress to deal an extra 2d6 damage and leap to Very Close range from the target.',
        placements: ['reviewAction'],
        stressCost: 1,
        onUse(table) {
          table.rolls?.damage?.addDie({ name: 'Kick', die: '2d6' });
          table.me.move(
            (t) => t.me.rangeFrom(t.action.target) === 'veryClose',
            'Very Close range from target',
            'Kick: leap to Very Close range from the target.',
            {
              freezeOtherInstanceId: table.action?.target?.instanceId,
              freezeReason: KICK_MAP_MOVE_LOCK,
              rehydrateKey: 'faun.kick.leap',
            }
          );
        },
      }
    ),
  ],
};
