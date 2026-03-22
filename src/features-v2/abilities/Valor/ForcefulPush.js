/**
 * Valor domain — Forceful Push (Tier 1)
 * SRD: Primary weapon Melee attack; knock to Close on hit; +d6 damage when Hope dominates; optional Hope for Vulnerable.
 */

import { when, isActing } from '../../engine/when.js';

function hopeDominates(table) {
  const h = table.rolls?.action?.hopeDie?.value;
  const f = table.rolls?.action?.fearDie?.value;
  if (h == null || f == null) return false;
  return h > f;
}

export const ForcefulPush = {
  name: 'Forceful Push',
  description:
    'Make an attack with your primary weapon against a target within Melee range. On a success, you deal damage and knock them back to Close range. On a success with Hope, add a **d6** to your damage roll. Additionally, you can **spend a Hope** to make them temporarily _Vulnerable_.',
  chips: [
    {
      placements: ['card'],
      name: 'Forceful Push',
      description:
        'Melee attack with your primary weapon. On a success: damage and knockback to Close. If Hope dominates, add d6 to damage (review chip). You may spend 1 Hope for Vulnerable (optional chip).',
      onUse(table) {
        table.me.actionLoop(
          'Forceful Push',
          'Make an attack with your primary weapon against a target within Melee range. On a success, you deal damage and knock the target back to Close range. Use the review chips for Hope: add a d6 to damage when Hope dominates, and optionally spend 1 Hope to make the target temporarily Vulnerable.',
          { type: 'attack' }
        );
      },
    },
    when(
      isActing,
      (t) => t.action?.type === 'attack' && t.rolls?.action?.isSuccess === true,
      (t) => t.rolls?.damage != null,
      hopeDominates,
      {
        placements: ['reviewAction'],
        name: 'Forceful Push — Hope damage',
        description: 'Hope dominated your attack roll: add a d6 to this attack’s damage.',
        onUse(table) {
          table.rolls?.damage?.addDie({ name: 'Forceful Push', die: 'd6' });
        },
      }
    ),
    when(
      isActing,
      (t) => t.action?.type === 'attack' && t.rolls?.action?.isSuccess === true,
      (t) => t.rolls?.damage != null,
      {
        placements: ['reviewAction'],
        name: 'Forceful Push — Vulnerable',
        hopeCost: 1,
        isToggle: true,
        description: 'Spend 1 Hope to make the target temporarily Vulnerable.',
        onUse(table) {
          table.me.actionLoop(
            'Forceful Push — Vulnerable',
            'Spend 1 Hope: the target becomes temporarily Vulnerable (GM applies).'
          );
        },
      }
    ),
  ],
};
