/**
 * Grace domain — Endless Charisma (Tier 2 spell card / level 7)
 * SRD: After you make an action roll to persuade, lie, or garner favor, you can spend a Hope to reroll the Hope or Fear Die.
 *
 * Engine: Presence trait action rolls cover persuade, lies, and garnering favor in typical play.
 */

import { when, isActing } from '../../engine/when.js';

function isPresenceCharmRoll(table) {
  const tr = table.action?.trait;
  return tr === 'presence' || tr === 'Presence';
}

export const EndlessCharisma = {
  name: 'Endless Charisma',
  description:
    'After you make an action roll to persuade, lie, or garner favor, you can **spend a Hope** to reroll the Hope or Fear Die.',
  chips: [
    when(
      isActing,
      (t) => isPresenceCharmRoll(t) && t.rolls?.action != null,
      {
        name: 'Endless Charisma — Reroll Hope',
        placements: ['reviewAction'],
        hopeCost: 1,
        description:
          'Spend 1 Hope to reroll your Hope die (after a Presence roll to persuade, lie, or garner favor).',
        onUse(table) {
          table.rolls?.action?.hopeDie?.reroll();
        },
      }
    ),
    when(
      isActing,
      (t) => isPresenceCharmRoll(t) && t.rolls?.action != null,
      {
        name: 'Endless Charisma — Reroll Fear',
        placements: ['reviewAction'],
        hopeCost: 1,
        description:
          'Spend 1 Hope to reroll your Fear die (after a Presence roll to persuade, lie, or garner favor).',
        onUse(table) {
          table.rolls?.action?.fearDie?.reroll();
        },
      }
    ),
  ],
};
