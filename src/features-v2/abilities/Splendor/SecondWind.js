/**
 * Splendor domain — Second Wind (Tier 1)
 * SRD: Once per rest, on a successful attack vs an adversary, clear 3 Stress or 1 HP;
 * if Hope is dominant, also clear 3 Stress or 1 HP on an ally within Close (GM).
 */

import { when, isActing } from '../../engine/when.js';

function anyTargetIsAdversary(table) {
  return table.action?.targets?.some((t) => t.isAdversary) === true;
}

function hopeDominant(table) {
  const h = table.rolls?.action?.hopeDie?.value;
  const f = table.rolls?.action?.fearDie?.value;
  if (h == null || f == null) return false;
  return h > f;
}

export const SecondWind = {
  name: 'Second Wind',
  description:
    'Once per rest, when you succeed on an attack against an adversary, you can clear 3 Stress or a Hit Point. On a success with Hope, you also clear 3 Stress or a Hit Point on an ally within Close range of you.',
  chips: [
    when(
      isActing,
      (t) => t.action?.type === 'attack',
      anyTargetIsAdversary,
      (t) => t.rolls?.action?.isSuccess === true,
      {
        name: 'Second Wind',
        placements: ['reviewAction'],
        frequency: 'rest',
        description:
          'After a successful attack vs an adversary: clear 3 Stress or 1 Hit Point on yourself. If Hope is dominant, also clear 3 Stress or 1 Hit Point on an ally within Close (GM).',
        onUse(table) {
          const allyNote = hopeDominant(table)
            ? ' Hope was dominant: also clear 3 Stress or 1 Hit Point on an ally within Close range of you (GM chooses ally and resource).'
            : '';
          table.me.actionLoop(
            'Second Wind',
            `Once per rest — after your successful attack vs an adversary: clear 3 Stress or 1 Hit Point on yourself.${allyNote}`,
            {}
          );
        },
      }
    ),
  ],
};
