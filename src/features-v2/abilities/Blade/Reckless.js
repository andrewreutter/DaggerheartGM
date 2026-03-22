/**
 * Blade domain — Reckless (Tier 1)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { when, isActing } from '../../engine/when.js';

export const Reckless = {
  name: 'Reckless',
  description: '**Mark a Stress** to gain advantage on an attack.',
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      {
        placements: ['intent'],
        label: 'Reckless',
        stressCost: 1,
        description: 'Mark a Stress to gain advantage on this attack.',
        onUse(table) {
          table.rolls?.action?.addAdvantageDie?.('Reckless');
        },
      }
    ),
  ],
};
