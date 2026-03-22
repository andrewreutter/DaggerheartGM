/**
 * Valor domain — Bold Presence (Tier 1)
 * SRD: On a Presence roll, spend 1 Hope to add Strength to the roll; once per rest avoid a condition when you would gain one.
 */

import { when, isActing } from '../../engine/when.js';

function isPresenceTrait(table) {
  const tr = table.action?.trait;
  return tr === 'presence' || tr === 'Presence';
}

export const BoldPresence = {
  name: 'Bold Presence',
  description:
    'When you make a Presence Roll, you can **spend a Hope** to add your Strength to the roll. Additionally, once per rest when you would gain a condition, you can describe how your bold presence aids you in the situation and avoid gaining the condition.',
  chips: [
    when(
      isActing,
      (t) => isPresenceTrait(t),
      (t) => t.rolls?.action != null,
      {
        placements: ['intent'],
        name: 'Bold Presence',
        hopeCost: 1,
        description: 'Spend 1 Hope to add your Strength to this Presence roll.',
        onUse(table) {
          const str = table.me?.traits?.strength ?? 0;
          if (str > 0) {
            table.rolls?.action?.addStatic?.({ name: 'Bold Presence', value: str });
          }
        },
      }
    ),
    {
      placements: ['card'],
      name: 'Bold Presence — Stand firm',
      frequency: 'rest',
      description:
        'Once per rest, when you would gain a condition, describe how your bold presence helps to avoid gaining that condition (GM resolves).',
      onUse(table) {
        table.me.actionLoop(
          'Bold Presence — Stand firm',
          'Once per rest, when you would gain a condition, describe how your bold presence aids you to avoid gaining that condition (GM resolves).'
        );
      },
    },
  ],
};
