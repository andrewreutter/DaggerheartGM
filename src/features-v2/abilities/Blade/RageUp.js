/**
 * Blade domain — Rage Up (Tier 1 / level 6)
 * SRD: daggerheart-srd/abilities/Rage Up.md
 */

import { when, isActing } from '../../engine/when.js';

function rageUpBonus(table) {
  const str = Number(table.me?.traits?.strength ?? 0);
  return Math.max(0, 2 * str);
}

export const RageUp = {
  name: 'Rage Up',
  description:
    'Before you make an attack, you can **mark a Stress** to gain a bonus to your damage roll equal to twice your Strength.\n\nYou can Rage Up twice per attack.',
  hooks: {
    onIntent: when(
      isActing,
      (t) => t.action?.type === 'attack',
      (table) => {
        table.feature.set('rageUpUses', 0);
      }
    ),
  },
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      {
        placements: ['intent'],
        label: 'Rage Up',
        stressCost: 1,
        description:
          'Mark a Stress to add twice your Strength to this attack\'s damage roll. You can Rage Up twice per attack.',
        isDisabled(table) {
          const uses = table.feature.get('rageUpUses') ?? 0;
          if (uses >= 2) return 'Already used Rage Up twice on this attack.';
          const cur = table.me.currentStress ?? 0;
          const max = table.me.maxStress ?? 0;
          if (cur >= max) return 'No empty Stress boxes to mark.';
          return false;
        },
        onUse(table) {
          const uses = table.feature.get('rageUpUses') ?? 0;
          if (uses >= 2) return;
          const bonus = rageUpBonus(table);
          table.feature.set('rageUpUses', uses + 1);
          table.rolls?.damage?.addStatic({ name: 'Rage Up', value: bonus });
        },
      }
    ),
  ],
};
