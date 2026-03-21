/**
 * Faun Ancestry Features (V2)
 *
 * SRD source: daggerheart-srd/ancestries/Faun.md
 */

import { when, isActing } from '../engine/when.js';

/** Successful melee attack — shared by both Kick chip variants. */
function kickMeleeAttackSuccess(table) {
  return (
    table.action?.type === 'attack' &&
    table.action?.range === 'melee' &&
    table.rolls?.action?.isSuccess === true
  );
}

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
      isActing,
      kickMeleeAttackSuccess,
      {
        name: 'Kick (push target)',
        description:
          'Mark 1 Stress to deal an extra 2d6 damage and knock the target to Very Close range.',
        placements: ['reviewOutcome'],
        stressCost: 1,
        onUse(table) {
          table.rolls?.damage?.addDie({ name: 'Kick', die: '2d6' });
          table.action?.target?.move(
            (t) => t.action.target?.rangeFrom(t.action.attacker) === 'veryClose',
            'Kick: knock target to Very Close range'
          );
        },
      }
    ),
    when(
      isActing,
      kickMeleeAttackSuccess,
      {
        name: 'Kick (leap back)',
        description:
          'Mark 1 Stress to deal an extra 2d6 damage and leap to Very Close range from the target.',
        placements: ['reviewOutcome'],
        stressCost: 1,
        onUse(table) {
          table.rolls?.damage?.addDie({ name: 'Kick', die: '2d6' });
          table.me.move(
            (t) =>
              t.action.target != null && t.me.rangeFrom(t.action.target) === 'veryClose',
            'Kick: leap to Very Close range from the target'
          );
        },
      }
    ),
  ],
};
