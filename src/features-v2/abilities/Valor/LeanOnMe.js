/**
 * Valor domain — Lean on Me (Tier 1)
 * SRD: Once per long rest, when you console or inspire an ally who failed an action roll, you both clear 2 Stress.
 */

import { when } from '../../engine/when.js';

export const LeanOnMe = {
  name: 'Lean on Me',
  description:
    'Once per long rest, when you console or inspire an ally who failed an action roll, you can both clear 2 Stress.',
  chips: [
    when(
      (table) => {
        if (table.me.isActing) return false;
        const actor = table.action?.actor;
        if (!actor?.isCharacter) return false;
        if (actor.instanceId === table.me.instanceId) return false;
        if (table.rolls?.action?.isSuccess !== false) return false;
        return true;
      },
      {
        name: 'Lean on Me',
        placements: ['reviewAction'],
        frequency: 'longRest',
        description:
          'After an ally fails an action roll, console or inspire them: you and your ally each clear 2 Stress.',
        onUse(table) {
          table.me.actionLoop(
            'Lean on Me',
            'You and your ally each clear 2 Stress (GM applies).'
          );
        },
      }
    ),
  ],
};
