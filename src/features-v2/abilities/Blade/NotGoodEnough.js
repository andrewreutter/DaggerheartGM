/**
 * Blade domain — Not Good Enough (Tier 1)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { when, isActing } from '../../engine/when.js';

function hasLowDamageFaces(table) {
  const dice = table.rolls?.damage?.dice ?? [];
  return dice.some((d) => d.value != null && d.value < 3);
}

export const NotGoodEnough = {
  name: 'Not Good Enough',
  description: 'When you roll your damage dice, you can reroll any 1s or 2s.',
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      hasLowDamageFaces,
      {
        placements: ['reviewAction'],
        label: 'Not Good Enough',
        description: 'Reroll damage dice that show 1 or 2.',
        onUse(table) {
          table.rolls?.damage?.rerollDiceBelow?.(3);
        },
      }
    ),
  ],
};
