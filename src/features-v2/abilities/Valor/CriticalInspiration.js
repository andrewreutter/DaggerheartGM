/**
 * Valor domain — Critical Inspiration (Tier 1)
 * SRD: Once per rest, when you critically succeed on an attack, allies within Very Close may clear Stress or gain Hope.
 */

import { when, isActing } from '../../engine/when.js';

export const CriticalInspiration = {
  name: 'Critical Inspiration',
  description:
    'Once per rest, when you critically succeed on an attack, all allies within Very Close range can clear a Stress or gain a Hope.',
  hooks: {
    onRest(table) {
      const t = table.action?.type;
      if (t !== 'shortRest' && t !== 'longRest') return;
      table.feature.set('criticalInspirationUsed', false);
    },
    onResolve: when(
      isActing,
      (t) => t.action?.type === 'attack',
      (t) => t.rolls?.action?.isCritical === true,
      (t) => !t.feature.get('criticalInspirationUsed'),
      (t) => {
        t.feature.set('criticalInspirationUsed', true);
        t.me.actionLoop(
          'Critical Inspiration',
          'You critically succeed on an attack: each ally within Very Close may clear 1 Stress or gain 1 Hope (their choice per ally; GM applies).'
        );
      }
    ),
  },
};
