/**
 * SRD consumable — Bolster Potion (roll table 02).
 */

import { when, isActing } from '../engine/when.js';

const MOD_ID = 'cns-bolster-potion-next-strength';

function hasBolsterModifier(table) {
  const mods = table.me.activeModifiers ?? [];
  return mods.some((m) => m.id === MOD_ID);
}

export const BolsterPotion = {
  name: 'Bolster Potion',
  description: 'You gain a +1 bonus to your next Strength Roll.',
  onUse(table) {
    table.me.addActiveModifier({
      id: MOD_ID,
      name: 'Bolster Potion',
    });
  },
  hooks: {
    onIntent: when(
      isActing,
      (table) => hasBolsterModifier(table) && table.action?.trait === 'Strength',
      (table) => {
        table.rolls?.action?.addStatic({ name: 'Bolster Potion', value: 1 });
        table.me.removeActiveModifier(MOD_ID);
      }
    ),
  },
};
