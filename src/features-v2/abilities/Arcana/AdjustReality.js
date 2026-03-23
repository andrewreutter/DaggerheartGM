/**
 * Arcana domain — Adjust Reality (level 10 spell card)
 * SRD: After you or a willing ally make any roll, spend 5 Hope to change numerical results to chosen values plausible within each die's range (GM updates the banner).
 */

import { when } from '../../engine/when.js';

function rollMadeByPc(table) {
  return table.action?.actor?.isCharacter === true;
}

export const AdjustReality = {
  name: 'Adjust Reality',
  description:
    'After you or a willing ally make any roll, you can **spend 5 Hope** to change the numerical result of that roll to a result of your choice instead. The result must be plausible within the range of the dice.',
  chips: [
    when(
      (table) => rollMadeByPc(table) && table.rolls?.action != null,
      {
        name: 'Adjust Reality — Action roll',
        placements: ['reviewAction'],
        hopeCost: 5,
        description:
          'Spend 5 Hope: choose new numerical results for this action roll’s dice — each must be plausible within that die’s range (GM applies on the banner).',
        onUse(table) {
          table.me.actionLoop(
            'Adjust Reality — Action roll',
            'Spend 5 Hope to change any numerical results on this action roll to values you choose — each must be plausible within that die’s range (Hope d12, Fear d12, trait dice, GM die, etc.). The GM updates the banner to match.'
          );
        },
      }
    ),
    when(
      (table) => rollMadeByPc(table) && table.rolls?.damage != null,
      {
        name: 'Adjust Reality — Damage roll',
        placements: ['reviewAction'],
        hopeCost: 5,
        description:
          'Spend 5 Hope: choose new numerical results for this damage roll’s dice — each must be plausible within that die’s range (GM applies on the banner).',
        onUse(table) {
          table.me.actionLoop(
            'Adjust Reality — Damage roll',
            'Spend 5 Hope to change any numerical results on this damage roll to values you choose — each must be plausible within each die’s range. The GM updates the banner to match.'
          );
        },
      }
    ),
  ],
};
